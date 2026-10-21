import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationCreatedAt,
  conversationSignature,
  deriveTitle,
  groupConversations,
  MAX_STORED_MESSAGES,
  MAX_STORED_TEXT,
  MAX_TITLE_LENGTH,
  newConversationId,
  readActiveConversation,
  toStoredMessages,
  writeActiveConversation,
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

test("el título es el primer mensaje del usuario, sin espacios de más y cortado", () => {
  assert.equal(deriveTitle([{ role: "ai", text: "hola" }, { role: "user", text: "  ventas\n por   sucursal " }, { role: "user", text: "otro" }]), "ventas por sucursal");
  assert.equal(deriveTitle([{ role: "user", text: "x".repeat(200) }]), `${"x".repeat(MAX_TITLE_LENGTH)}…`);
  assert.equal(deriveTitle([{ role: "ai", text: "hola" }]), "Conversación");
});

test("la fecha de creación sale del prefijo ISO del id", () => {
  assert.equal(conversationCreatedAt("2026-10-21T12:00:00.000Z_ab12cd34"), "2026-10-21T12:00:00.000Z");
});

test("el historial se agrupa por día local de creación y conserva el orden", () => {
  const now = new Date(2026, 9, 21, 15, 0);
  const at = (daysAgo, hour = 10) => new Date(2026, 9, 21 - daysAgo, hour).toISOString();
  const item = (daysAgo, hour = 10) => ({ conversationId: `c-${daysAgo}-${hour}`, title: "t", createdAt: at(daysAgo, hour), updatedAt: at(daysAgo, hour), expiresAt: "" });
  const groups = groupConversations([item(0, 14), item(0, 9), item(1), item(3), item(7), item(8), item(20)], now);

  assert.deepEqual(groups.map((g) => [g.label, g.items.map((i) => i.conversationId)]), [
    ["Hoy", ["c-0-14", "c-0-9"]],
    ["Ayer", ["c-1-10"]],
    ["Últimos 7 días", ["c-3-10", "c-7-10"]],
    ["Más antiguas", ["c-8-10", "c-20-10"]],
  ]);
});

test("una fecha inválida no rompe el agrupado", () => {
  const groups = groupConversations([{ conversationId: "x", title: "t", createdAt: "no-es-fecha", updatedAt: "", expiresAt: "" }]);

  assert.deepEqual(groups.map((g) => g.label), ["Más antiguas"]);
});

test("la conversación activa se guarda y se borra en el storage de la pestaña", () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };

  assert.equal(readActiveConversation(storage), null);
  writeActiveConversation("2026-10-21T12:00:00.000Z_ab12cd34", storage);
  assert.equal(readActiveConversation(storage), "2026-10-21T12:00:00.000Z_ab12cd34");
  writeActiveConversation(null, storage);
  assert.equal(readActiveConversation(storage), null);
});

test("un storage que lanza errores no rompe la conversación activa", () => {
  const broken = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); }, removeItem() { throw new Error("bloqueado"); } };

  assert.equal(readActiveConversation(broken), null);
  assert.doesNotThrow(() => writeActiveConversation("x", broken));
  assert.doesNotThrow(() => writeActiveConversation(null, broken));
});
