import type { ApiAssistantHistoryTurn, ApiConversationSummary, ApiReport, ApiStoredMessage } from "../api/client";

// Deben coincidir con MAX_MESSAGES / MAX_TEXT_LENGTH en ticket-parsing-cloud/src/conversations/conversationStore.ts.
export const MAX_STORED_MESSAGES = 100;
export const MAX_STORED_TEXT = 20_000;

export interface ChatMessage {
  id: number;
  role: "ai" | "user";
  text: string;
  /** Contenido del reporte para los botones de PDF/CSV; al restaurar se vuelve a pedir con `reportId`. */
  report?: ApiReport;
  reportId?: string;
  /** Saludo inicial y errores de conexión: se muestran, pero no forman parte de la conversación guardada. */
  transient?: boolean;
}

/** ISO de creación + sufijo, el mismo formato que el reportId: la conversación más nueva ordena última. */
export function newConversationId(now: Date = new Date(), random: Pick<Crypto, "getRandomValues"> = crypto): string {
  const bytes = random.getRandomValues(new Uint8Array(4));
  return `${now.toISOString()}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// Debe coincidir con MAX_TITLE_LENGTH / deriveTitle en ticket-parsing-cloud/src/conversations/conversationStore.ts.
export const MAX_TITLE_LENGTH = 60;

/** Título del historial: el primer mensaje del usuario, con espacios colapsados y cortado. */
export function deriveTitle(messages: ApiStoredMessage[]): string {
  const text = (messages.find((m) => m.role === "user")?.text ?? "").replace(/\s+/g, " ").trim();
  return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH).trimEnd()}…` : text || "Conversación";
}

/** La parte ISO del id es la fecha de creación (el backend la guarda igual en `createdAt`). */
export function conversationCreatedAt(conversationId: string): string {
  return conversationId.split("_")[0];
}

export interface ConversationGroup { label: string; items: ApiConversationSummary[] }

/** Agrupa el historial por día de creación (hora local) en Hoy / Ayer / Últimos 7 días / Más antiguas, conservando el orden. */
export function groupConversations(items: ApiConversationSummary[], now: Date = new Date()): ConversationGroup[] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const groups: ConversationGroup[] = [];
  for (const item of items) {
    const created = new Date(item.createdAt);
    const days = Number.isNaN(created.getTime()) ? Infinity : Math.round((today - startOfDay(created)) / 86_400_000);
    const label = days <= 0 ? "Hoy" : days === 1 ? "Ayer" : days <= 7 ? "Últimos 7 días" : "Más antiguas";
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

// La conversación abierta sobrevive a un refresh de la pestaña, pero una pestaña nueva arranca en blanco
// (el resto se abre desde el historial). Solo se guarda el id: el contenido siempre sale del backend.
const ACTIVE_KEY = "innoapp.ai.activeConversation";

export function readActiveConversation(storage: Pick<Storage, "getItem"> | undefined = safeSessionStorage()): string | null {
  try {
    return storage?.getItem(ACTIVE_KEY) || null;
  } catch {
    return null;
  }
}

export function writeActiveConversation(conversationId: string | null, storage: Pick<Storage, "setItem" | "removeItem"> | undefined = safeSessionStorage()) {
  try {
    if (conversationId) storage?.setItem(ACTIVE_KEY, conversationId);
    else storage?.removeItem(ACTIVE_KEY);
  } catch {
    // Sin storage (modo privado, cuota): tras un refresh se vuelve a la vista en blanco.
  }
}

function safeSessionStorage(): Storage | undefined {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

export function toStoredMessages(messages: ChatMessage[]): ApiStoredMessage[] {
  return messages
    .filter((m) => !m.transient && m.text.trim())
    .slice(-MAX_STORED_MESSAGES)
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_STORED_TEXT), ...(m.reportId ? { reportId: m.reportId } : {}) }));
}

/** Para no volver a guardar lo que acaba de restaurarse ni lo que ya se guardó. */
export function conversationSignature(conversationId: string, messages: ApiStoredMessage[], history: ApiAssistantHistoryTurn[]): string {
  return JSON.stringify([conversationId, messages, history]);
}
