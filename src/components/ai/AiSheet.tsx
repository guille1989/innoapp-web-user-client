import { useRef, useState } from "react";
import { api, type ApiAssistantHistoryTurn } from "../../api/client";
import { respondLocally } from "../../lib/aiAssistant";
import { IconAi, IconClose, IconSend } from "../icons";
import type { BusinessEvent, Widget } from "../../types";

// Debe coincidir con MAX_HISTORY_TURNS en ticket-parsing-cloud/src/assistant/askHandler.ts.
const MAX_HISTORY_TURNS = 6;

interface AiSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  events: BusinessEvent[];
  onCreateWidget: (cfg: Omit<Widget, "id">) => void;
  idToken: string;
}

interface ChatMessage {
  id: number;
  role: "ai" | "user";
  content: React.ReactNode;
}

const SUGGESTED = [
  { q: "¿Cuál sucursal vendió más hoy?", label: "Sucursal con más ventas" },
  { q: "Hazme una gráfica de ventas por sucursal", label: "Gráfica por sucursal" },
  { q: "Crea un kpi con el conteo de devoluciones", label: "KPI de devoluciones" },
];

let msgSeq = 1;

export function AiSheet({ open, onOpen, onClose, events, onCreateWidget, idToken }: AiSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: msgSeq++, role: "ai", content: "Hola, soy tu asistente de datos. Puedo analizar las lecturas de tus agentes y crear widgets por ti." }]);
  const [input, setInput] = useState("");
  const [dockInput, setDockInput] = useState("");
  const [typing, setTyping] = useState(false);
  // Solo los intercambios que de verdad pasaron por el asistente (Bedrock) —
  // las respuestas locales (regex, crear widgets) no cuentan como
  // conversación con el modelo, así que no se agregan acá.
  const [history, setHistory] = useState<ApiAssistantHistoryTurn[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });
  }

  function pushAiMessage(content: React.ReactNode) {
    setMessages((prev) => [...prev, { id: msgSeq++, role: "ai", content }]);
    scrollToBottom();
  }

  async function send(question: string) {
    const value = question.trim();
    if (!value || typing) return;
    setMessages((prev) => [...prev, { id: msgSeq++, role: "user", content: value }]);
    setInput("");
    setDockInput("");
    setTyping(true);
    scrollToBottom();

    // Primero los patrones locales (crear widgets, "¿qué robot vendió más?")
    // — gratis e instantáneos, sin red. Lo que no reconocen se lo mandamos
    // al asistente real (Bedrock + datos del negocio), no a un texto fijo.
    const local = respondLocally(value, events);
    if (local) {
      window.setTimeout(() => {
        const content = local.kind === "widget" ? <><span>Listo, añadí </span><span className="mono-inline">{local.cfg.title}</span><span> a tu dashboard.</span></> : local.text;
        if (local.kind === "widget") onCreateWidget(local.cfg);
        setTyping(false);
        pushAiMessage(content);
      }, 650);
      return;
    }

    try {
      const { answer } = await api.assistantAsk(idToken, value, history);
      setTyping(false);
      pushAiMessage(answer);
      const newTurns: ApiAssistantHistoryTurn[] = [
        { role: "user", text: value },
        { role: "assistant", text: answer },
      ];
      setHistory((prev) => [...prev, ...newTurns].slice(-MAX_HISTORY_TURNS));
    } catch {
      setTyping(false);
      pushAiMessage("No pude conectarme con el asistente, probá de nuevo en un momento.");
    }
  }

  function submitDock() {
    if (!dockInput.trim()) { onOpen(); return; }
    onOpen();
    void send(dockInput);
  }

  return (
    <>
      {!open && (
        <div className="ai-dock glass">
          <div className="ai-dock-orb"><IconAi /></div>
          <input value={dockInput} onChange={(e) => setDockInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitDock(); }} placeholder="Pregunta a tu agente sobre cualquier dato…" aria-label="Pregunta al asistente" />
          <button onClick={submitDock} aria-label="Enviar al asistente"><IconSend /></button>
        </div>
      )}
      <section className={`sheet ai-sheet${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="sheet-handle" />
        <header className="ai-head">
          <div className="ai-head-title"><div className="ai-avatar"><IconAi /></div><div><div className="ai-title-text">Asistente de datos</div><div className="ai-subtitle"><span className="pulse-dot" /> Datos sincronizados en tiempo real</div></div></div>
          <button className="ai-close" onClick={onClose} aria-label="Cerrar asistente"><IconClose /></button>
        </header>
        <div className="ai-body" ref={bodyRef}>
          {messages.map((message) => <div className={`msg ${message.role}`} key={message.id}><div className="msg-avatar">{message.role === "ai" ? "IA" : "Tú"}</div><div className="msg-bubble">{message.content}</div></div>)}
          {typing && <div className="msg ai"><div className="msg-avatar">IA</div><div className="msg-bubble"><div className="typing"><span /><span /><span /></div></div></div>}
        </div>
        <div className="suggested">{SUGGESTED.map((item) => <button className="chip" key={item.q} onClick={() => void send(item.q)}>{item.label}</button>)}</div>
        <div className="ai-input-wrap">
          <textarea className="ai-input" rows={1} placeholder="Pregunta o pide un KPI…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} />
          <button className="ai-send" onClick={() => void send(input)} aria-label="Enviar"><IconSend /></button>
        </div>
      </section>
    </>
  );
}
