import test from "node:test";
import assert from "node:assert/strict";
import { configureBusinessTimeZone, effectiveTimeZone } from "../src/lib/businessTimeZone.ts";
import { localDateKey, todayKey, resolveRange } from "../src/lib/chartScale.ts";
import { periodRange } from "../src/lib/periodFilter.ts";

/**
 * Instant where UTC/browser-as-UTC is already 12-nov, but America/Bogota
 * (UTC−5) is still 11-nov 22:30 — the audit case for «hoy» diverging.
 */
const CROSS_MIDNIGHT = "2026-11-12T03:30:00.000Z";
const BUSINESS_TZ = "America/Bogota";

function withFixedNow(iso, fn) {
  const original = globalThis.Date;
  const fixed = new original(iso);
  globalThis.Date = class extends original {
    constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }
    static now() { return fixed.getTime(); }
  };
  try { return fn(); } finally { globalThis.Date = original; }
}

test.afterEach(() => configureBusinessTimeZone(null));

test("localDateKey con zona del negocio cruza medianoche distinta a UTC", () => {
  withFixedNow(CROSS_MIDNIGHT, () => {
    assert.equal(localDateKey(0, "UTC"), "2026-11-12");
    assert.equal(localDateKey(0, BUSINESS_TZ), "2026-11-11");
    assert.equal(localDateKey(-1, BUSINESS_TZ), "2026-11-10");
    assert.equal(localDateKey(1, BUSINESS_TZ), "2026-11-12");
  });
});

test("configureBusinessTimeZone alinea todayKey / periodRange con el negocio", () => {
  withFixedNow(CROSS_MIDNIGHT, () => {
    configureBusinessTimeZone(null);
    // Sin negocio: cae al navegador (en CI suele ser UTC).
    const browserToday = todayKey();
    assert.equal(browserToday, new Intl.DateTimeFormat("en-CA", {
      timeZone: effectiveTimeZone(),
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(CROSS_MIDNIGHT)));

    configureBusinessTimeZone(BUSINESS_TZ);
    assert.equal(effectiveTimeZone(), BUSINESS_TZ);
    assert.equal(todayKey(), "2026-11-11");
    assert.deepEqual(periodRange({ preset: "today" }), { from: "2026-11-11", to: "2026-11-11" });
    assert.deepEqual(resolveRange("today", {}, undefined, undefined), { from: "2026-11-11", to: "2026-11-11" });
    assert.deepEqual(periodRange({ preset: "7d" }), { from: "2026-11-05", to: "2026-11-11" });
    assert.deepEqual(periodRange({ preset: "month" }), { from: "2026-11-01", to: "2026-11-11" });
  });
});

test("zona inválida o ausente: fallback al navegador", () => {
  configureBusinessTimeZone("Marte/Olympus");
  assert.notEqual(effectiveTimeZone(), "Marte/Olympus");
  configureBusinessTimeZone(null);
  assert.ok(typeof effectiveTimeZone() === "string" && effectiveTimeZone().length > 0);
});
