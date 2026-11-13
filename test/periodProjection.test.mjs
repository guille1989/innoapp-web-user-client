import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { configureBusinessTimeZone } from "../src/lib/businessTimeZone.ts";
import { periodProjection } from "../src/lib/periodFilter.ts";
globalThis.document = { documentElement: { style: { setProperty() {} } } };
const { WidgetCard } = await import("../src/components/dashboard/WidgetCard.tsx");

const NOW = "2026-11-13T15:00:00.000Z";

function withFixedNow(fn) {
  const original = globalThis.Date;
  const fixed = new original(NOW);
  globalThis.Date = class extends original {
    constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }
    static now() { return fixed.getTime(); }
  };
  try { return fn(); } finally { globalThis.Date = original; }
}

test.beforeEach(() => configureBusinessTimeZone("America/Bogota"));
test.afterEach(() => configureBusinessTimeZone(null));

test("mes en curso: días del mes completo, no los transcurridos", () => {
  withFixedNow(() => assert.deepEqual(periodProjection({ preset: "month" }), { days: 30, noun: "mes" }));
});

test("trimestre y semestre en curso (3.er trimestre = 92 días, 2.º semestre = 184)", () => {
  withFixedNow(() => {
    assert.deepEqual(periodProjection({ preset: "quarter" }), { days: 92, noun: "trimestre" });
    assert.deepEqual(periodProjection({ preset: "semester" }), { days: 184, noun: "semestre" });
  });
});

test("mes cerrado elegido con anchor: sus propios días (febrero 2026 = 28)", () => {
  withFixedNow(() => assert.deepEqual(periodProjection({ preset: "month", anchor: "2026-02" }), { days: 28, noun: "mes" }));
});

test("un anchor del período en curso o futuro se ignora", () => {
  withFixedNow(() => assert.equal(periodProjection({ preset: "month", anchor: "2027-01" }).days, 30));
});

test("sin período de calendario no hay proyección", () => {
  withFixedNow(() => {
    for (const preset of ["today", "7d", "30d", "90d", "week", "all", "custom"]) assert.equal(periodProjection({ preset }), null, preset);
  });
});

const kpi = (agg) => ({ id: "w", type: "kpi", title: "Promedio de ventas", field: "total", agg, group: null, dataStatus: "ready", data: [{ key: "total", value: 100 }] });
const render = (widget) => renderToStaticMarkup(React.createElement(WidgetCard, { widget, events: [], onRemove() {}, onDragStart() {}, onResizeStart() {} }));

test("el KPI de promedio diario muestra la proyección del mes; el de suma no", () => {
  withFixedNow(() => {
    const daily = render(kpi("daily_avg"));
    assert.match(daily, /Proyección del mes/);
    assert.match(daily, /3\.000/); // 100 × 30 días
    assert.doesNotMatch(render(kpi("sum")), /Proyección/);
  });
});
