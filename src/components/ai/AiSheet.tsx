import { useRef, useState } from "react";
import { respond } from "../../lib/aiAssistant";
import { IconAi, IconClose, IconSend } from "../icons";
import type { BusinessEvent, Widget } from "../../types";

interface AiSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  events: BusinessEvent[];
  onCreateWidget: (cfg: Omit<Widget, "id">) => void;
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

export function AiSheet({ open, onOpen, onClose, events, onCreateWidget }: AiSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: msgSeq++, role: "ai", content: "Hola, soy tu asistente de datos. Puedo analizar las lecturas de tus agentes y crear widgets por ti." }]);
  const [input, setInput] = useState("");
  const [dockInput, setDockInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });
  }

  function send(question: string) {
    const value = question.trim();
    if (!value || typing) return;
    setMessages((prev) => [...prev, { id: msgSeq++, role: "user", content: value }]);
    setInput("");
    setDockInput("");
    setTyping(true);
    scrollToBottom();
    window.setTimeout(() => {
      const res = respond(value, events);
      const content = res.kind === "widget" ? <><span>Listo, añadí </span><span className="mono-inline">{res.cfg.title}</span><span> a tu dashboard.</span></> : res.text;
      if (res.kind === "widget") onCreateWidget(res.cfg);
      setTyping(false);
      setMessages((prev) => [...prev, { id: msgSeq++, role: "ai", content }]);
      scrollToBottom();
    }, 650);
  }

  function submitDock() {
    if (!dockInput.trim()) { onOpen(); return; }
    onOpen();
    send(dockInput);
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
        <div className="suggested">{SUGGESTED.map((item) => <button className="chip" key={item.q} onClick={() => send(item.q)}>{item.label}</button>)}</div>
        <div className="ai-input-wrap">
          <textarea className="ai-input" rows={1} placeholder="Pregunta o pide un KPI…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
          <button className="ai-send" onClick={() => send(input)} aria-label="Enviar"><IconSend /></button>
        </div>
      </section>
    </>
  );
}
