import assert from "node:assert/strict";
import test from "node:test";
import { briefingSpoken, greetingFor, greetingWord, orbStateFor } from "../src/lib/innova.ts";

const spokenMatter = (id, spoken, status = "new") => ({ id, severity: "warn", status, title: `T${id}`, spoken });
const greeting = { headline: "Buenos días. Soy Innova.", sub: "Hay 2 cosas que revisar. Pregúntame." };

test("el resumen hablado lee el saludo y los avisos nuevos más urgentes, y avisa del resto", () => {
  const text = briefingSpoken(greeting, [spokenMatter(1, "Uno."), spokenMatter(2, "Dos."), spokenMatter(3, "Tres."), spokenMatter(4, "Cuatro."), spokenMatter(5, "Cinco.")]);
  assert.equal(text, "Buenos días. Soy Innova. Uno. Dos. Tres. Y hay 2 más en pantalla.");
});

test("el resumen hablado ignora lo ya visto y, sin avisos, dice la frase de que todo está en orden", () => {
  assert.equal(briefingSpoken(greeting, [spokenMatter(1, "Uno.", "seen")]), "Buenos días. Soy Innova. Hay 2 cosas que revisar. Pregúntame.");
  assert.equal(briefingSpoken(greeting, [spokenMatter(1, "Uno.")]), "Buenos días. Soy Innova. Uno.");
  assert.equal(briefingSpoken(greeting, [spokenMatter(1, "Uno."), spokenMatter(2, "Dos."), spokenMatter(3, "Tres."), spokenMatter(4, "Cuatro.")]).endsWith("Y hay 1 más en pantalla."), true);
});

const matter = (overrides) => ({ id: "m", severity: "warn", status: "new", ...overrides });

test("el saludo cambia según la hora", () => {
  assert.equal(greetingWord(5), "Buenos días");
  assert.equal(greetingWord(11), "Buenos días");
  assert.equal(greetingWord(12), "Buenas tardes");
  assert.equal(greetingWord(19), "Buenas tardes");
  assert.equal(greetingWord(20), "Buenas noches");
  assert.equal(greetingWord(3), "Buenas noches");
});

test("el saludo cuenta solo los avisos nuevos, con singular y plural", () => {
  const morning = new Date(2026, 10, 3, 9, 0);
  assert.match(greetingFor(morning, []).sub, /no hay nada que requiera tu atención/);
  assert.match(greetingFor(morning, [matter({ status: "seen" })]).sub, /no hay nada/);
  assert.match(greetingFor(morning, [matter({})]).sub, /Hay 1 cosa que revisar/);
  assert.match(greetingFor(morning, [matter({}), matter({}), matter({ status: "seen" })]).sub, /Hay 2 cosas que revisar/);
  assert.equal(greetingFor(morning, []).headline, "Buenos días. Soy Innova.");
});

test("responder manda sobre escuchar, y escuchar sobre la alerta", () => {
  const critical = [matter({ severity: "critical" })];
  assert.equal(orbStateFor({ thinking: true, listening: true, speaking: true, matters: critical }), "thinking");
  assert.equal(orbStateFor({ thinking: false, speaking: true, listening: true, matters: critical }), "speaking");
  assert.equal(orbStateFor({ thinking: false, listening: true, matters: critical }), "listening");
});

test("en reposo, solo un aviso crítico sin ver lo pone en alerta", () => {
  assert.equal(orbStateFor({ thinking: false, matters: [] }), "idle");
  assert.equal(orbStateFor({ thinking: false, matters: [matter({ severity: "warn" })] }), "idle");
  assert.equal(orbStateFor({ thinking: false, matters: [matter({ severity: "critical", status: "seen" })] }), "idle");
  assert.equal(orbStateFor({ thinking: false, matters: [matter({ severity: "critical" })] }), "alert");
});
