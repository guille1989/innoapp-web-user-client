import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildTimeSeries, isAdditive } from "../src/lib/chartScale.ts";
import { respondLocally } from "../src/lib/aiAssistant.tsx";
import { widgetDataFailure, widgetDataSuccess } from "../src/lib/widgetDataState.ts";
globalThis.document = { documentElement: { style: { setProperty() {} } } };
const { WidgetCard } = await import("../src/components/dashboard/WidgetCard.tsx");

const average = { field: "total", agg: "avg" };
const range = { from: "2026-10-01", to: "2026-10-02" };

test("el ticket medio mensual pondera los tickets, no los días", () => {
  const rows = [{ key: range.from, value: 100, sampleCount: 1 }, { key: range.to, value: 10, sampleCount: 99 }];
  assert.equal(buildTimeSeries(rows, average, range, "month")[0].value, 10.9);
});

test("el promedio semanal usa el mismo peso que el mensual", () => {
  const rows = [{ key: range.from, value: 100, sampleCount: 1 }, { key: range.to, value: 10, sampleCount: 99 }];
  assert.equal(buildTimeSeries(rows, average, range, "week")[0].value, 10.9);
});

test("los promedios antiguos sin pesos no generan una media de medias", () => {
  const rows = [{ key: range.from, value: 100 }, { key: range.to, value: 10 }];
  assert.equal(buildTimeSeries(rows, average, range, "month")[0].value, null);
  assert.equal(buildTimeSeries(rows, average, range, "day")[0].value, 100);
});

test("un cero observado participa en la media ponderada", () => {
  const rows = [{ key: range.from, value: 0, sampleCount: 9 }, { key: range.to, value: 10, sampleCount: 1 }];
  assert.equal(buildTimeSeries(rows, average, range, "month")[0].value, 1);
});

test("sumas y conteos siguen siendo aditivos y los promedios vacíos son huecos", () => {
  assert.equal(buildTimeSeries([{ key: range.from, value: 100 }, { key: range.to, value: 10 }], { field: "total", agg: "sum" }, range, "month")[0].value, 110);
  assert.deepEqual(buildTimeSeries([], average, range, "day").map((point) => point.value), [null, null]);
});

test("conteos de tickets por producto pueden solaparse y no se suman", () => {
  assert.equal(isAdditive({ field: "event_count", agg: "count", group: "description" }), false);
  assert.equal(isAdditive({ field: "event_count", agg: "count", group: "day" }), true);
});

test("las preguntas de ventas no se contestan con una muestra del navegador", () => {
  for (const question of ["¿Qué robot vendió más hoy?", "¿Qué robot vendió menos hoy?", "¿Qué robot tiene más fallos?"]) {
    assert.equal(respondLocally(question), null);
  }
});

test("un fallo conserva la respuesta previa, marcada con su fecha y error", () => {
  const valid = widgetDataSuccess([{ value: 700 }], "2026-10-20T10:00:00Z");
  const state = widgetDataFailure(valid, "Athena no respondió");
  assert.deepEqual(state, { data: [{ value: 700 }], status: "stale", error: "Athena no respondió", updatedAt: valid.updatedAt });
  assert.equal(widgetDataFailure(undefined, "error").status, "error");
  assert.deepEqual(widgetDataFailure(widgetDataSuccess([]), "error").data, []);
});

const widget = { id: "w1", type: "kpi", title: "Ventas", field: "total", agg: "sum", group: null, dataStatus: "ready" };
const props = { events: [{ eventType: "venta", monto: 999999, items: 1 }], onRemove() {}, onDragStart() {}, onResizeStart() {} };
function render(config) {
  return renderToStaticMarkup(React.createElement(WidgetCard, { ...props, widget: { ...widget, ...config } }));
}

test("un KPI vacío nunca sustituye sus datos por los eventos locales", () => {
  const html = render({ data: [] });
  assert.match(html, /Sin datos/);
  assert.doesNotMatch(html, /999/);
});

test("el KPI conserva el cero real y oculta cifras en estado error", () => {
  assert.match(render({ data: [{ key: "total", value: 0 }] }), />0</);
  const html = render({ dataStatus: "error", data: [{ key: "total", value: 123 }] });
  assert.match(html, /No se pudieron consultar/);
  assert.doesNotMatch(html, />123</);
});

test("el último KPI correcto muestra su desactualización", () => {
  const html = render({ dataStatus: "stale", updatedAt: "2026-10-20T10:00:00Z", data: [{ key: "total", value: 700 }] });
  assert.match(html, /Datos sin actualizar/);
  assert.match(html, /último resultado válido/);
  assert.match(html, />700</);
});
