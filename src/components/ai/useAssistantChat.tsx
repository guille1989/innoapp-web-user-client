import { useEffect, useState } from "react";
import { api, ApiError, type ApiAssistantHistoryTurn, type ApiReport } from "../../api/client";
import { downloadReportCsv, printReport } from "../../lib/report";
import { respondLocally } from "../../lib/aiAssistant";
import { useRequestScope } from "../../hooks/useRequestScope";
import type { Widget } from "../../types";

// Debe coincidir con MAX_HISTORY_TURNS en ticket-parsing-cloud/src/assistant/askHandler.ts.
const MAX_HISTORY_TURNS = 6;
// Debe coincidir con MINUTE_LIMIT en ticket-parsing-cloud/src/assistant/rateLimit.ts.
// El backend cuenta por minuto de reloj (bloques de 60 s), así que acá se usa el mismo bloque.
export const MINUTE_LIMIT = 10;
const currentMinute = () => Math.floor(Date.now() / 60_000);

export interface ChatMessage {
  id: number;
  role: "ai" | "user";
  content: React.ReactNode;
}

export const SUGGESTED = [
  { q: "¿Cuál sucursal vendió más hoy?", label: "Sucursal con más ventas" },
  { q: "Hazme una gráfica de ventas por sucursal", label: "Gráfica por sucursal" },
  { q: "Crea un kpi con el conteo de tickets", label: "KPI de tickets" },
];

let msgSeq = 1;

/**
 * El modelo marca énfasis con **negrita**. Se renderiza solo eso (como nodos de
 * React, nunca como HTML) y se respetan los saltos de línea de las listas;
 * cualquier otro markdown se muestra tal cual.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <span style={{ whiteSpace: "pre-wrap" }}>{parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}</span>;
}

function ReportMessage({ answer, report, businessName, saved }: { answer: string; report: ApiReport; businessName: string; saved: boolean }) {
  return (
    <>
      <div><RichText text={answer} /></div>
      <div className="report-actions" style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button className="chip" onClick={() => printReport(report, answer, businessName)}>Ver / guardar PDF</button>
        <button className="chip" onClick={() => downloadReportCsv(report)}>Descargar CSV</button>
      </div>
      {saved && <div style={{ fontSize: "calc(11px * var(--afs, 1))", opacity: 0.7, marginTop: 6 }}>Guardado en la sección Reportes por 30 días.</div>}
    </>
  );
}

interface UseAssistantChatOptions {
  idToken: string;
  businessName: string;
  onCreateWidget: (cfg: Omit<Widget, "id">) => Promise<void>;
  /** El backend guardó un reporte nuevo: la lista de Reportes y el widget del dashboard se refrescan. */
  onReportSaved: () => void;
}

/** Estado y envío de la conversación con el asistente de datos; lo comparten el panel flotante y la vista IA. */
export function useAssistantChat({ idToken, businessName, onCreateWidget, onReportSaved }: UseAssistantChatOptions) {
  const scope = useRequestScope(idToken);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: msgSeq++, role: "ai", content: "Hola, soy tu asistente de datos. Puedo analizar las lecturas de tus agentes y crear widgets por ti." }]);
  const [typing, setTyping] = useState(false);
  // Solo los intercambios que de verdad pasaron por el asistente (Bedrock) —
  // las respuestas locales (regex, crear widgets) no cuentan como
  // conversación con el modelo, así que no se agregan acá.
  const [history, setHistory] = useState<ApiAssistantHistoryTurn[]>([]);
  // Medidor de uso del asistente: preguntas enviadas al backend en el minuto actual.
  const [usage, setUsage] = useState({ minute: currentMinute(), count: 0 });
  const [dayBlocked, setDayBlocked] = useState(false);
  const [now, setNow] = useState(Date.now());
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

  function pushAiMessage(content: React.ReactNode) {
    setMessages((prev) => [...prev, { id: msgSeq++, role: "ai", content }]);
  }

  /** `onAccepted` corre cuando la pregunta se acepta (antes de la respuesta), para que el llamador limpie su input. */
  async function send(question: string, onAccepted?: () => void) {
    const value = question.trim();
    if (!value || typing) return;
    const previousQuestion = [...history].reverse().find((t) => t.role === "user")?.text;
    const local = respondLocally(value, previousQuestion);
    const isLocal = local !== null;
    if (!isLocal && blocked) return;
    setMessages((prev) => [...prev, { id: msgSeq++, role: "user", content: value }]);
    onAccepted?.();
    setTyping(true);

    const task = scope.start("message");
    // La ruta local solo propone widgets; las cifras se consultan en el servidor.
    if (local) {
      try {
        await onCreateWidget(local.cfg);
        if (task.isCurrent()) pushAiMessage(<><span>Listo, añadí </span><span className="mono-inline">{local.cfg.title}</span><span> a tu dashboard.</span></>);
      } catch (err) {
        if (task.isCurrent()) pushAiMessage(err instanceof Error ? err.message : "No se pudo crear el widget.");
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
      pushAiMessage(report ? <ReportMessage answer={answer} report={report} businessName={businessName} saved={Boolean(reportId)} /> : <RichText text={answer} />);
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
      pushAiMessage(apiMessage ?? "No pude conectarme con el asistente, probá de nuevo en un momento.");
    } finally {
      task.finish();
    }
  }

  const usageNotice = dayBlocked
    ? "Llegaste al límite diario del asistente. Podés volver a preguntar mañana."
    : remaining === 0
      ? `Límite alcanzado: podés volver a preguntar en ${waitSeconds} s.`
      : usedNow > 0 ? `Preguntas disponibles este minuto: ${remaining} de ${MINUTE_LIMIT}` : null;

  return { messages, typing, blocked, usageNotice, send };
}
