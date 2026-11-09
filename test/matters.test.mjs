import assert from "node:assert/strict";
import test from "node:test";
import { applyMark, countUnseen, questionAbout, sortMatters } from "../src/lib/matters.ts";

const matter = (overrides) => ({
  id: "m", detector: "agent_offline", scope: "total", branchLabel: null, title: "Título", detail: "Detalle.", spoken: "",
  periodDate: "2026-11-03", severity: "warn", status: "new", expected: null, actual: null, evidence: {},
  createdAt: "", updatedAt: "", seenAt: null, resolvedAt: null, ...overrides,
});

test("ordena lo no visto primero, luego lo más grave y luego lo más reciente", () => {
  const sorted = sortMatters([
    matter({ id: "visto-grave", status: "seen", severity: "critical" }),
    matter({ id: "nuevo-info", severity: "info" }),
    matter({ id: "nuevo-grave-viejo", severity: "critical", periodDate: "2026-11-01" }),
    matter({ id: "nuevo-grave-reciente", severity: "critical", periodDate: "2026-11-03" }),
  ]);
  assert.deepEqual(sorted.map((m) => m.id), ["nuevo-grave-reciente", "nuevo-grave-viejo", "nuevo-info", "visto-grave"]);
});

test("ordenar no modifica la lista original", () => {
  const original = [matter({ id: "a", severity: "info" }), matter({ id: "b", severity: "critical" })];
  sortMatters(original);
  assert.deepEqual(original.map((m) => m.id), ["a", "b"]);
});

test("cuenta solo los avisos nuevos", () => {
  assert.equal(countUnseen([matter({}), matter({ status: "seen" }), matter({}), matter({ status: "dismissed" })]), 2);
  assert.equal(countUnseen([]), 0);
});

test("descartar quita el aviso y visto lo deja en la lista atenuado", () => {
  const list = [matter({ id: "a" }), matter({ id: "b" })];
  assert.deepEqual(applyMark(list, "a", "dismissed").map((m) => m.id), ["b"]);
  const seen = applyMark(list, "a", "seen");
  assert.deepEqual(seen.map((m) => `${m.id}:${m.status}`), ["a:seen", "b:new"]);
  assert.equal(list[0].status, "new", "no muta la lista original");
});

test("la pregunta nombra el aviso y nunca supera el tope del backend (el detalle va por matterId)", () => {
  const question = questionAbout({ title: "TPV Sol lleva 3 horas sin conectarse", detail: "Revisa el equipo." });
  assert.match(question, /TPV Sol lleva 3 horas sin conectarse/);
  assert.doesNotMatch(question, /Revisa el equipo/);
  assert.ok(questionAbout({ title: "x".repeat(900) }).length <= 500);
});
