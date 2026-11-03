import assert from "node:assert/strict";
import test from "node:test";
import { defaultLang, pickVoice, speakableText, splitSentences } from "../src/lib/speech.ts";

test("las frases se cortan en el punto con espacio, no dentro de una cifra con separador de miles", () => {
  assert.deepEqual(splitSentences("Ayer vendiste 5.224 con 520 tickets. Un martes normal."), ["Ayer vendiste 5.224 con 520 tickets.", "Un martes normal."]);
  assert.deepEqual(splitSentences("¿Seguro? Sí… claro."), ["¿Seguro?", "Sí…", "claro."]);
});

test("lo hablado no lleva negritas, viñetas ni encabezados", () => {
  const text = speakableText("## Resumen\n- Vendiste **5.224** ayer\n- Hubo 520 tickets");
  assert.equal(text, "Resumen. Vendiste 5.224 ayer. Hubo 520 tickets.");
  assert.doesNotMatch(text, /[*#-]/);
});

test("una tabla no se lee: se avisa que el detalle está en pantalla", () => {
  const text = speakableText("Ventas por sucursal:\n\n| Sucursal | Ventas |\n|---|---:|\n| Sol | 1.585 |\n| Lavapiés | 1.088 |");
  assert.equal(text, "Ventas por sucursal: El detalle está en pantalla.");
});

test("si la respuesta es solo una tabla, igual se dice algo", () => {
  assert.equal(speakableText("| a | b |\n|---|---|\n| 1 | 2 |"), "Te dejé el detalle en pantalla.");
  assert.equal(speakableText(""), "");
});

test("una respuesta larga se recorta en una frase completa y se avisa", () => {
  const sentences = Array.from({ length: 30 }, (_, i) => `Esta es la frase número ${i + 1} del informe.`).join(" ");
  const text = speakableText(sentences);
  assert.ok(text.length < 480, `demasiado larga: ${text.length}`);
  assert.ok(text.endsWith("El detalle está en pantalla."));
  assert.match(text, /frase número 1 del informe\./);
  assert.doesNotMatch(text, /frase número 30/);
});

test("una respuesta corta sale tal cual, sin aviso", () => {
  assert.equal(speakableText("Ayer vendiste **5.224** con 520 tickets."), "Ayer vendiste 5.224 con 520 tickets.");
});

const voices = [
  { name: "Microsoft Pablo - Spanish (Spain)", lang: "es-ES" },
  { name: "Microsoft Dalia Online (Natural) - Spanish (Mexico)", lang: "es-MX" },
  { name: "Google español de Estados Unidos", lang: "es-US" },
  { name: "Microsoft Zira - English (United States)", lang: "en-US" },
];

test("elige una voz natural en español y nunca una de otro idioma", () => {
  assert.equal(pickVoice(voices, "es-CO").name, "Microsoft Dalia Online (Natural) - Spanish (Mexico)");
  assert.equal(pickVoice([{ name: "Zira", lang: "en-US" }], "es-CO"), null);
  assert.equal(pickVoice([], "es-CO"), null);
});

test("a igual naturalidad, gana la que coincide con el idioma; y la elegida a mano manda", () => {
  const plain = [{ name: "Voz A", lang: "es-MX" }, { name: "Voz B", lang: "es-CO" }];
  assert.equal(pickVoice(plain, "es-CO").name, "Voz B");
  assert.equal(pickVoice(voices, "es-CO", "Microsoft Pablo - Spanish (Spain)").name, "Microsoft Pablo - Spanish (Spain)");
  assert.equal(pickVoice(voices, "es-CO", "No existe").name, "Microsoft Dalia Online (Natural) - Spanish (Mexico)");
});

test("el idioma por defecto sale del navegador solo si es uno de los ofrecidos", () => {
  assert.equal(defaultLang("es-ES"), "es-ES");
  assert.equal(defaultLang("es-mx"), "es-MX");
  assert.equal(defaultLang("es-CL"), "es-CO");
  assert.equal(defaultLang("en-US"), "es-CO");
  assert.equal(defaultLang(undefined), "es-CO");
});
