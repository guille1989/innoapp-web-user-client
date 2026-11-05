import test from "node:test";
import assert from "node:assert/strict";
import { resolveRange } from "../src/lib/chartScale.ts";
import { isHoliday } from "../src/lib/holidays.ts";

/** Resuelve el preset "hoy" siendo la fecha local `day` (mediodía, lejos de cualquier borde de zona). */
function on(day, preset) {
  const original = globalThis.Date;
  const fixed = new original(`${day}T12:00:00`);
  globalThis.Date = class extends original {
    constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }
    static now() { return fixed.getTime(); }
  };
  try { return resolveRange(preset, {}, undefined, undefined); } finally { globalThis.Date = original; }
}

test("festivos de Colombia 2026 que caen en lunes", () => {
  for (const day of ["2026-01-12", "2026-03-23", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16"]) {
    assert.ok(isHoliday(day), day);
  }
  assert.ok(isHoliday("2026-04-02") && isHoliday("2026-04-03"), "Jueves y Viernes Santo");
  assert.ok(!isHoliday("2026-11-09") && !isHoliday("2026-11-03"));
});

test("semana: del lunes a hoy, y desde el martes si el lunes fue festivo", () => {
  assert.deepEqual(on("2026-11-05", "week"), { from: "2026-11-03", to: "2026-11-05" }); // lunes 2-nov festivo
  assert.deepEqual(on("2026-11-26", "week"), { from: "2026-11-23", to: "2026-11-26" }); // lunes normal
  assert.deepEqual(on("2026-11-29", "week"), { from: "2026-11-23", to: "2026-11-29" }); // domingo cierra la semana
  assert.deepEqual(on("2026-11-02", "week"), { from: "2026-11-02", to: "2026-11-02" }); // hoy es el festivo
});

test("mes, trimestre y semestre: calendario en curso", () => {
  assert.deepEqual(on("2026-11-05", "month"), { from: "2026-11-01", to: "2026-11-05" });
  assert.deepEqual(on("2026-11-05", "quarter"), { from: "2026-10-01", to: "2026-11-05" });
  assert.deepEqual(on("2026-11-05", "semester"), { from: "2026-07-01", to: "2026-11-05" });
  assert.deepEqual(on("2026-03-31", "quarter"), { from: "2026-01-01", to: "2026-03-31" });
  assert.deepEqual(on("2026-06-30", "semester"), { from: "2026-01-01", to: "2026-06-30" });
});

test("mes elegido: un mes cerrado va completo; el actual (o uno futuro) llega hasta hoy", () => {
  const pickUnit = (preset, anchor) => {
    const original = globalThis.Date;
    const fixed = new original("2026-11-05T12:00:00");
    globalThis.Date = class extends original {
      constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }
      static now() { return fixed.getTime(); }
    };
    try { return resolveRange(preset, { anchor }, undefined, undefined); } finally { globalThis.Date = original; }
  };
  assert.deepEqual(pickUnit("month", "2026-10"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(pickUnit("month", "2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(pickUnit("month", "2025-12"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(pickUnit("month", "2026-11"), { from: "2026-11-01", to: "2026-11-05" });
  assert.deepEqual(pickUnit("month", "2027-01"), { from: "2026-11-01", to: "2026-11-05" });
});

test("trimestre y semestre elegidos: cerrados completos; el en curso llega hasta hoy", () => {
  const original = globalThis.Date;
  const fixed = new original("2026-11-05T12:00:00");
  globalThis.Date = class extends original {
    constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }
    static now() { return fixed.getTime(); }
  };
  try {
    assert.deepEqual(resolveRange("quarter", { anchor: "2026-07" }, undefined, undefined), { from: "2026-07-01", to: "2026-09-30" });
    assert.deepEqual(resolveRange("quarter", { anchor: "2025-10" }, undefined, undefined), { from: "2025-10-01", to: "2025-12-31" });
    assert.deepEqual(resolveRange("quarter", { anchor: "2026-10" }, undefined, undefined), { from: "2026-10-01", to: "2026-11-05" });
    assert.deepEqual(resolveRange("semester", { anchor: "2026-01" }, undefined, undefined), { from: "2026-01-01", to: "2026-06-30" });
    assert.deepEqual(resolveRange("semester", { anchor: "2025-07" }, undefined, undefined), { from: "2025-07-01", to: "2025-12-31" });
    assert.deepEqual(resolveRange("semester", { anchor: "2026-07" }, undefined, undefined), { from: "2026-07-01", to: "2026-11-05" });
  } finally { globalThis.Date = original; }
});
