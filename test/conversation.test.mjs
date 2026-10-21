import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationSignature,
  MAX_STORED_MESSAGES,
  MAX_STORED_TEXT,
  newConversationId,
  toStoredMessages,
} from "../src/lib/conversation.ts";

// Mismo formato que valida el backend (conversationStore.ts).
const BACKEND_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z_[0-9a-f]{8}$/;

test("el id de conversación tiene el formato que acepta el backend y ordena por fecha", () => {
  const first = newConversationId(new Date("2026-10-21T12:00:00.000Z"));
  const second = newConversationId(new Date("2026-10-21T12:00:01.000Z"));

  assert.match(first, BACKEND_ID_PATTERN);
  assert.match(second, BACKEND_ID_PATTERN);
  assert.ok(first < second);
});

test("dos ids creados en el mismo instante no colisionan", () => {
  const now = new Date("2026-10-21T12:00:00.000Z");
  assert.notEqual(newConversationId(now), newConversationId(now));
});

test("solo se guardan los mensajes reales: ni el saludo ni los errores de conexión", () => {
  const stored = toStoredMessages([
    { id: 1, role: "ai", text: "Hola, soy tu asistente", transient: true },
    { id: 2, role: "user", text: "¿Cuánto vendimos?" },
    { id: 3, role: "ai", text: "No pude conectarme", transient: true },
    { id: 4, role: "ai", text: "Vendiste **$100**.", reportId: "2026-10-21T12:00:00.000Z_aa11bb22", report: { title: "grande", sections: [] } },
  ]);

  assert.deepEqual(stored, [
    { role: "user", text: "¿Cuánto vendimos?" },
    { role: "ai", text: "Vendiste **$100**.", reportId: "2026-10-21T12:00:00.000Z_aa11bb22" },
  ]);
});

test("el reporte completo no viaja en la conversación, solo su reportId", () => {
  const [message] = toStoredMessages([{ id: 1, role: "ai", text: "listo", reportId: "r1", report: { title: "x", sections: [] } }]);

  assert.equal("report" in message, false);
});

test("se conservan los últimos mensajes si la conversación supera el límite del backend", () => {
  const messages = Array.from({ length: MAX_STORED_MESSAGES + 5 }, (_, i) => ({ id: i, role: "user", text: `m${i}` }));
  const stored = toStoredMessages(messages);

  assert.equal(stored.length, MAX_STORED_MESSAGES);
  assert.equal(stored[0].text, "m5");
  assert.equal(stored.at(-1).text, `m${MAX_STORED_MESSAGES + 4}`);
});

test("un texto más largo que el límite se corta en vez de hacer fallar el guardado", () => {
  const [message] = toStoredMessages([{ id: 1, role: "ai", text: "x".repeat(MAX_STORED_TEXT + 100) }]);

  assert.equal(message.text.length, MAX_STORED_TEXT);
});

test("la firma cambia solo cuando cambia el contenido guardado", () => {
  const messages = [{ role: "user", text: "hola" }];
  const history = [{ role: "user", text: "hola" }];

  assert.equal(conversationSignature("c1", messages, history), conversationSignature("c1", [{ role: "user", text: "hola" }], [{ role: "user", text: "hola" }]));
  assert.notEqual(conversationSignature("c1", messages, history), conversationSignature("c2", messages, history));
  assert.notEqual(conversationSignature("c1", messages, history), conversationSignature("c1", [...messages, { role: "ai", text: "qué tal" }], history));
});
