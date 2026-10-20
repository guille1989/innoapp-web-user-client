import assert from "node:assert/strict";
import test from "node:test";
import { reportToCsv, reportToHtml } from "../src/lib/report.ts";

const section = (overrides = {}) => ({
  kind: "kpi", heading: "Ventas", field: "total", aggregation: "sum", data: [{ value: 100 }], ...overrides,
});
const report = (...sections) => ({ title: "Informe", generatedAt: "2026-10-20T12:00:00.000Z", sections });
const html = (...sections) => reportToHtml(report(...sections), "", "Negocio");

test("KPI distingue cero de ausencia y conserva los decimales sin inferir moneda", () => {
  assert.match(html(section({ data: [{ value: null }] })), /class="kpi-value">Sin datos</);
  assert.match(html(section({ data: [] })), /class="kpi-value">Sin datos</);
  assert.match(html(section({ data: [{ value: 0 }] })), /class="kpi-value">0</);
  const average = html(section({ aggregation: "avg", data: [{ value: 10.9, sampleCount: 100 }] }));
  assert.match(average, /class="kpi-value">10,9</);
  assert.doesNotMatch(average, /\$|€|NaN|Infinity/);
});

test("comparación requiere datos actuales y anteriores: NULL nunca se convierte en cero ni porcentaje", () => {
  const withoutPrevious = html(section({ previous: null }));
  assert.match(withoutPrevious, /Sin datos del periodo anterior/);
  assert.doesNotMatch(withoutPrevious, /% vs periodo anterior/);
  const withoutCurrent = html(section({ data: [{ value: null }], previous: 100 }));
  assert.doesNotMatch(withoutCurrent, /<div class="delta/);
  assert.match(html(section({ previous: 0 })), /Sin base de comparación/);
  assert.match(html(section({ data: [{ value: 0 }], previous: 100 })), /100 % vs periodo anterior/);
});

test("CSV conserva la ausencia como Sin datos y exporta el cero real y valor decimal numérico", () => {
  const csv = reportToCsv(report(section({ kind: "ranking", groupBy: "port", data: [
    { label: "Ausente", value: null }, { label: "Cero", value: 0 }, { label: "Promedio", value: 10.9, sampleCount: 100 },
  ] })));
  assert.match(csv, /Ausente;Sin datos/);
  assert.match(csv, /Cero;0/);
  assert.match(csv, /Promedio;10.9/);
  assert.match(reportToCsv(report(section({ data: [] }))), /Total;Sin datos/);
});

test("gráfica filtra valores ausentes y el anexo los conserva explícitamente", () => {
  const result = html(section({ kind: "trend", groupBy: "day", data: [
    { label: "2026-10-19", value: null }, { label: "2026-10-20", value: 0 },
  ] }));
  const chart = result.match(/<svg[^>]*>.*?<\/svg>/)?.[0] ?? "";
  assert.equal((chart.match(/<rect /g) ?? []).length, 1);
  assert.doesNotMatch(chart, /2026-10-19|NaN|Infinity/);
  assert.match(result, /<td>2026-10-19<\/td><td class="n">Sin datos<\/td>/);
  const noValues = html(section({ kind: "trend", data: [{ value: null }] }));
  assert.match(noValues, /Sin datos en este periodo/);
  assert.doesNotMatch(noValues, /<svg/);
});

test("ranking excluye ausencias del dibujo, sin eliminarlas del anexo", () => {
  const result = html(section({ kind: "ranking", data: [
    { label: "Ausente", value: null }, { label: "Cero", value: 0 }, { label: "Venta", value: 10 },
  ] }));
  const chart = result.split('<div class="rank">')[1].split('<section class="annex">')[0];
  assert.doesNotMatch(chart, /rank-name">Ausente/);
  assert.match(chart, /rank-name">Cero/);
  assert.match(result, /<td>Ausente<\/td><td class="n">Sin datos<\/td>/);
  assert.doesNotMatch(result, /NaN|Infinity/);
});

const leading = Array.from({ length: 8 }, (_, index) => ({ label: `Principal ${index}`, value: 1000 - index, sampleCount: 1 }));
test("Otros preserva AVG ponderado: 100 con peso1 y10 con peso99 producen10,9", () => {
  const result = html(section({ kind: "ranking", aggregation: "avg", data: [
    ...leading, { label: "Menor A", value: 100, sampleCount: 1 }, { label: "Menor B", value: 10, sampleCount: 99 },
  ] }));
  assert.match(result, /rank-name">Otros \(2\)<\/div>.*?rank-val">10,9<\/div>/);
});

test("AVG histórico sin pesos y conteos de tickets por producto no inventan una cifra Otros", () => {
  for (const overrides of [{ aggregation: "avg" }, { field: "event_count", groupBy: "description" }]) {
    const result = html(section({ kind: "ranking", ...overrides, data: [
      ...leading, { label: "Menor A", value: 100 }, { label: "Menor B", value: 10 },
    ] }));
    assert.doesNotMatch(result, /rank-name">Otros/);
    assert.match(result, /El resto se detalla en el anexo/);
    assert.match(result, /<td>Menor A<\/td>/);
  }
});

test("barras con valores negativos mantienen alturas y anchos válidos", () => {
  const data = [{ label: "2026-10-19", value: -10 }, { label: "2026-10-20", value: 5 }];
  const trend = html(section({ kind: "trend", data }));
  const ranking = html(section({ kind: "ranking", data }));
  assert.doesNotMatch(trend, /height="-|NaN|Infinity/);
  assert.doesNotMatch(ranking, /style="width:-|NaN|Infinity/);
});
