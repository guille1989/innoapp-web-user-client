import assert from "node:assert/strict";
import test from "node:test";
import { configureAmountFormat, fmtAmount } from "../src/data/format.ts";
import { openingHoursSummary, profileCopyHint } from "../src/lib/businessProfile.ts";
import { greetingFor } from "../src/lib/innova.ts";

test("fmtAmount sin moneda sigue siendo solo número", () => {
  configureAmountFormat({});
  assert.equal(fmtAmount(12345), "12.345");
});

test("fmtAmount con COP usa símbolo de moneda", () => {
  configureAmountFormat({ currency: "COP", locale: "es-CO" });
  const formatted = fmtAmount(12345);
  assert.match(formatted, /12\.345|12,345/);
  assert.match(formatted, /\$|COP/);
  configureAmountFormat({});
});

test("openingHoursSummary resume default y byWeekday", () => {
  assert.equal(openingHoursSummary(undefined), null);
  assert.equal(
    openingHoursSummary({ default: { open: "08:00", close: "20:00" }, byWeekday: { "7": "closed" } }),
    "08:00–20:00; dom cerrado",
  );
});

test("profileCopyHint solo habla de moneda/horarios cuando existen", () => {
  assert.equal(profileCopyHint(null), "");
  assert.equal(profileCopyHint({}), "");
  assert.match(profileCopyHint({ currency: "COP" }), /montos en COP/);
  assert.match(profileCopyHint({ openingHours: { default: { open: "09:00", close: "18:00" } } }), /horario 09:00–18:00/);
});

test("greetingFor incluye hint de ficha cuando hay moneda", () => {
  const morning = new Date(2026, 10, 3, 9, 0);
  const { sub } = greetingFor(morning, [], "Empanadas El Sol", { currency: "COP" });
  assert.match(sub, /Empanadas El Sol/);
  assert.match(sub, /montos en COP/);
});
