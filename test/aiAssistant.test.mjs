import assert from "node:assert/strict";
import test from "node:test";
import { respondLocally } from "../src/lib/aiAssistant.tsx";

test("el pedido del usuario con producto y sucursal ya no se resuelve en el navegador", () => {
  assert.equal(respondLocally("hazme un kpi para hacer seguimiento solo a las ventas de cafe con leche en la sucursal de sol"), null);
});

test("cualquier condición desconocida (producto, sucursal, periodo) va al asistente", () => {
  assert.equal(respondLocally("crea un kpi de ventas de empanadas"), null);
  assert.equal(respondLocally("un kpi de ventas en la sucursal Atocha"), null);
  assert.equal(respondLocally("kpi de ventas solo de octubre"), null);
});

test("las órdenes simples siguen siendo locales", () => {
  assert.equal(respondLocally("Hazme una gráfica de ventas por sucursal")?.cfg.type, "bar");
  assert.equal(respondLocally("Crea un kpi con el conteo de tickets")?.cfg.type, "kpi");
  assert.equal(respondLocally("una gráfica de la evolución de ventas por día")?.cfg.type, "line");
  assert.equal(respondLocally("quiero un kpi del ticket medio")?.cfg.agg, "avg");
});

test("un KPI de 'promedio de ventas' es el promedio diario, no el ticket medio", () => {
  for (const q of ["Hazme un KPI de promedio de ventas", "crea un kpi con la venta promedio por día", "quiero un kpi del promedio de las ventas"]) {
    const cfg = respondLocally(q)?.cfg;
    assert.equal(cfg?.type, "kpi", q);
    assert.equal(cfg?.field, "total", q);
    assert.equal(cfg?.agg, "daily_avg", q);
    assert.equal(cfg?.title, "KPI: Promedio de ventas", q);
  }
});

test("el promedio diario solo existe en un KPI y 'ticket medio/promedio' sigue siendo por ticket", () => {
  assert.equal(respondLocally("hazme un kpi del ticket promedio")?.cfg.agg, "avg");
  assert.equal(respondLocally("hazme un kpi del ticket promedio")?.cfg.title, "KPI: Ticket medio");
  assert.equal(respondLocally("hazme una gráfica del promedio de ventas por sucursal")?.cfg.agg, "avg");
});

test("'ponme en un widget' toma el tema de la pregunta anterior", () => {
  assert.equal(respondLocally("ponme en un widget", "quiero ver el ticket medio")?.cfg.agg, "avg");
});

test("las preguntas sin visualización no crean widgets", () => {
  assert.equal(respondLocally("¿qué día vendimos más?"), null);
});
