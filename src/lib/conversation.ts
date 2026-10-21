import type { ApiAssistantHistoryTurn, ApiReport, ApiStoredMessage } from "../api/client";

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
