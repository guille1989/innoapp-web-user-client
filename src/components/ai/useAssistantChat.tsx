import { useEffect, useRef, useState } from "react";
import { api, ApiError, type ApiAssistantHistoryTurn, type ApiConversation, type ApiConversationSummary } from "../../api/client";
import { respondLocally } from "../../lib/aiAssistant";
import {
  conversationCreatedAt, conversationSignature, deriveTitle, newConversationId, readActiveConversation, toStoredMessages, writeActiveConversation, type ChatMessage,
} from "../../lib/conversation";
import { useRequestScope } from "../../hooks/useRequestScope";
import type { Widget } from "../../types";

// Debe coincidir con MAX_HISTORY_TURNS en ticket-parsing-cloud/src/assistant/askHandler.ts.
const MAX_HISTORY_TURNS = 6;
// Debe coincidir con MINUTE_LIMIT en ticket-parsing-cloud/src/assistant/rateLimit.ts.
// El backend cuenta por minuto de reloj (bloques de 60 s), así que acá se usa el mismo bloque.
export const MINUTE_LIMIT = 10;
const currentMinute = () => Math.floor(Date.now() / 60_000);
// Si la conversación guardada no llega en este tiempo, se arranca de cero en vez de dejar la vista en blanco.
const RESTORE_TIMEOUT_MS = 4000;

export type { ChatMessage };

export const SUGGESTED = [
  { q: "¿Cuál sucursal vendió más hoy?", label: "Sucursal con más ventas" },
  { q: "Hazme una gráfica de ventas por sucursal", label: "Gráfica por sucursal" },
  { q: "Crea un kpi con el conteo de tickets", label: "KPI de tickets" },
];

let msgSeq = 1;

const greeting = (): ChatMessage => ({ id: msgSeq++, role: "ai", text: "Hola, soy tu asistente de datos. Puedo analizar las lecturas de tus agentes y crear widgets por ti.", transient: true });

interface UseAssistantChatOptions {
  idToken: string;
  onCreateWidget: (cfg: Omit<Widget, "id">) => Promise<void>;
  /** El backend guardó un reporte nuevo: la lista de Reportes y el widget del dashboard se refrescan. */
  onReportSaved: () => void;
  /** Guarda la conversación en el backend y la restaura al volver a cargar la página. */
  persist?: boolean;
  /** El backend guardó la conversación: el historial actualiza su fila (título nuevo, fecha de actividad). */
  onConversationSaved?: (summary: ApiConversationSummary) => void;
}

/** Estado y envío de la conversación con el asistente de datos; lo comparten el panel flotante y la vista IA. */
export function useAssistantChat({ idToken, onCreateWidget, onReportSaved, persist = false, onConversationSaved }: UseAssistantChatOptions) {
  const scope = useRequestScope(idToken);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greeting()]);
  const [typing, setTyping] = useState(false);
  // Solo los intercambios que de verdad pasaron por el asistente (Bedrock) —
  // las respuestas locales (regex, crear widgets) no cuentan como
  // conversación con el modelo, así que no se agregan acá.
  const [history, setHistory] = useState<ApiAssistantHistoryTurn[]>([]);
  // Medidor de uso del asistente: preguntas enviadas al backend en el minuto actual.
  const [usage, setUsage] = useState({ minute: currentMinute(), count: 0 });
  const [dayBlocked, setDayBlocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Sin persistencia no hay nada que restaurar: la conversación está lista desde el inicio.
  const [ready, setReady] = useState(!persist);
  // Renovar el JWT no debe volver a restaurar la conversación: los efectos leen el token vigente de acá.
  const token = useRef(idToken);
  token.current = idToken;
  const onSaved = useRef(onConversationSaved);
  onSaved.current = onConversationSaved;
  // Conversación abierta: el ref lo leen los efectos, el estado resalta la fila del historial.
  const conversationId = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const usedNow = usage.minute === currentMinute() ? usage.count : 0;
  const remaining = Math.max(0, MINUTE_LIMIT - usedNow);
  const waitSeconds = remaining === 0 ? Math.max(1, Math.ceil(((currentMinute() + 1) * 60_000 - now) / 1000)) : 0;
  const blocked = dayBlocked || remaining === 0;

  // Tick de 1 s solo mientras hay algo que mostrar/contar (consumo del minuto o bloqueo).
  useEffect(() => {
    if (usedNow === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [usedNow]);

  // Vuelca una conversación guardada en el hilo. Los reportes no viajan en ella: se piden aparte
  // para que los botones de PDF/CSV vuelvan a funcionar.
  function applyConversation(conversation: ApiConversation, signal: AbortSignal) {
    conversationId.current = conversation.conversationId;
    setActiveId(conversation.conversationId);
    lastSaved.current = conversationSignature(conversation.conversationId, conversation.messages, conversation.history);
    setMessages([greeting(), ...conversation.messages.map((m): ChatMessage => ({ id: msgSeq++, role: m.role, text: m.text, ...(m.reportId ? { reportId: m.reportId } : {}) }))]);
    setHistory(conversation.history);
    for (const message of conversation.messages) {
      if (!message.reportId) continue;
      void api.report(token.current, message.reportId, signal).then(
        ({ report }) => { if (!signal.aborted) setMessages((prev) => prev.map((m) => (m.reportId === message.reportId ? { ...m, report } : m))); },
        () => {}, // vencido o borrado: queda el texto sin botones
      );
    }
  }

  // Pide una conversación con tope de tiempo: si el backend tarda o falla devuelve null y quien llama decide.
  async function fetchConversation(id: string, task: { signal: AbortSignal; isCurrent: () => boolean }): Promise<ApiConversation | null> {
    const timeout = new AbortController();
    const timer = window.setTimeout(() => timeout.abort(), RESTORE_TIMEOUT_MS);
    const onAbort = () => timeout.abort();
    task.signal.addEventListener("abort", onAbort);
    try {
      const conversation = await api.conversation(token.current, id, timeout.signal);
      return task.isCurrent() && !timeout.signal.aborted ? conversation : null;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
      task.signal.removeEventListener("abort", onAbort);
    }
  }

  // Tras un refresh se reabre la conversación que estaba abierta en esta pestaña; una pestaña nueva
  // arranca en blanco (el historial es el camino a las demás). Si falla, se arranca de cero.
  useEffect(() => {
    if (!persist) return;
    const id = readActiveConversation();
    if (!id) { setReady(true); return; }
    const task = scope.start("restore-conversation");
    void (async () => {
      const conversation = await fetchConversation(id, task);
      if (conversation) applyConversation(conversation, task.signal);
      else if (task.isCurrent()) writeActiveConversation(null);
      if (task.isCurrent()) setReady(true);
      task.finish();
    })();
    // Solo depende de `persist`/`scope`: las funciones de arriba leen refs y su comportamiento no cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, scope]);

  // Guarda al terminar cada intercambio (no mientras el asistente responde). Los guardados van
  // encadenados para que lleguen en orden; un fallo no interrumpe el chat.
  useEffect(() => {
    if (!persist || !ready || typing) return;
    const stored = toStoredMessages(messages);
    if (stored.length === 0) return;
    conversationId.current ??= newConversationId();
    const id = conversationId.current;
    if (activeId !== id) setActiveId(id);
    writeActiveConversation(id);
    const signature = conversationSignature(id, stored, history);
    if (signature === lastSaved.current) return;
    lastSaved.current = signature;
    const title = deriveTitle(stored);
    saveChain.current = saveChain.current.then(() => api.saveConversation(token.current, id, { messages: stored, history }).then(
      () => { onSaved.current?.({ conversationId: id, title, createdAt: conversationCreatedAt(id), updatedAt: new Date().toISOString(), expiresAt: "" }); },
      () => { lastSaved.current = null; },
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, ready, typing, messages, history]);

  function pushAiMessage(message: Omit<ChatMessage, "id" | "role">) {
    setMessages((prev) => [...prev, { id: msgSeq++, role: "ai", ...message }]);
  }

  /** `onAccepted` corre cuando la pregunta se acepta (antes de la respuesta), para que el llamador limpie su input. */
  async function send(question: string, onAccepted?: () => void) {
    const value = question.trim();
    if (!value || typing || !ready) return;
    const previousQuestion = [...history].reverse().find((t) => t.role === "user")?.text;
    const local = respondLocally(value, previousQuestion);
    const isLocal = local !== null;
    if (!isLocal && blocked) return;
    setMessages((prev) => [...prev, { id: msgSeq++, role: "user", text: value }]);
    onAccepted?.();
    setTyping(true);

    const task = scope.start("message");
    // La ruta local solo propone widgets; las cifras se consultan en el servidor.
    if (local) {
      try {
        await onCreateWidget(local.cfg);
        if (task.isCurrent()) pushAiMessage({ text: `Listo, añadí **${local.cfg.title}** a tu dashboard.` });
      } catch (err) {
        if (task.isCurrent()) pushAiMessage({ text: err instanceof Error ? err.message : "No se pudo crear el widget.", transient: true });
      } finally {
        if (task.isCurrent()) setTyping(false);
        task.finish();
      }
      return;
    }

    setNow(Date.now());
    setUsage((u) => (u.minute === currentMinute() ? { minute: u.minute, count: u.count + 1 } : { minute: currentMinute(), count: 1 }));
    try {
      const { answer, report, reportId } = await api.assistantAsk(idToken, value, history, task.signal);
      if (!task.isCurrent()) return;
      setTyping(false);
      if (reportId) onReportSaved();
      pushAiMessage({ text: answer, ...(report ? { report } : {}), ...(reportId ? { reportId } : {}) });
      const newTurns: ApiAssistantHistoryTurn[] = [
        { role: "user", text: value },
        { role: "assistant", text: answer },
      ];
      setHistory((prev) => [...prev, ...newTurns].slice(-MAX_HISTORY_TURNS));
    } catch (err) {
      if (!task.isCurrent()) return;
      setTyping(false);
      if (err instanceof ApiError && err.status === 429) {
        // Sincroniza con el servidor: si dice que no hay más, el medidor queda en 0 hasta el próximo minuto.
        if (/hoy|mañana/.test(err.message)) setDayBlocked(true);
        else setUsage({ minute: currentMinute(), count: MINUTE_LIMIT });
      }
      // TypeError = fetch falló antes de recibir respuesta (red); cualquier otro Error trae el mensaje de la API (ej. rate limit 429).
      const apiMessage = err instanceof Error && !(err instanceof TypeError) ? err.message : null;
      pushAiMessage({ text: apiMessage ?? "No pude conectarme con el asistente, probá de nuevo en un momento.", transient: true });
    } finally {
      task.finish();
    }
  }

  /** Empieza un hilo nuevo: la conversación anterior queda guardada en el historial. */
  function startNewConversation() {
    scope.cancel("message");
    scope.cancel("open-conversation");
    conversationId.current = null;
    lastSaved.current = null;
    setActiveId(null);
    writeActiveConversation(null);
    setReady(true);
    setTyping(false);
    setMessages([greeting()]);
    setHistory([]);
  }

  /** Abre una conversación del historial. Una respuesta en curso se cancela para que no caiga en el hilo equivocado. */
  async function openConversation(id: string) {
    if (!persist || id === conversationId.current) return;
    scope.cancel("message");
    const task = scope.start("open-conversation");
    setTyping(false);
    setReady(false);
    const conversation = await fetchConversation(id, task);
    if (!task.isCurrent()) return;
    if (conversation) {
      applyConversation(conversation, task.signal);
      writeActiveConversation(id);
    } else {
      pushAiMessage({ text: "No pude abrir esa conversación, probá de nuevo en un momento.", transient: true });
    }
    setReady(true);
    task.finish();
  }

  const usageNotice = dayBlocked
    ? "Llegaste al límite diario del asistente. Podés volver a preguntar mañana."
    : remaining === 0
      ? `Límite alcanzado: podés volver a preguntar en ${waitSeconds} s.`
      : usedNow > 0 ? `Preguntas disponibles este minuto: ${remaining} de ${MINUTE_LIMIT}` : null;

  return { messages, typing, ready, blocked, usageNotice, activeId, send, startNewConversation, openConversation };
}
