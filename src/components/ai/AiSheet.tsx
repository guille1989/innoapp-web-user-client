import { useEffect, useRef, useState } from "react";
import { IconAi, IconClose, IconSend } from "../icons";
import { TextSizeControl } from "../dashboard/TextSizeControl";
import { useFontLevel } from "../dashboard/fontScale";
import { ChatMessageContent } from "./ChatMessageContent";
import { SUGGESTED, useAssistantChat } from "./useAssistantChat";
import type { ApiBusinessProfile } from "../../api/client";
import type { Widget } from "../../types";

interface AiSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCreateWidget: (cfg: Omit<Widget, "id">) => Promise<void>;
  idToken: string;
  businessName: string;
  profile?: ApiBusinessProfile | null;
  /** El backend guardó un reporte nuevo: la lista de Reportes y el widget del dashboard se refrescan. */
  onReportSaved: () => void;
  /** Oculta el campo flotante: la entrada al asistente es la vista IA. */
  hideDock?: boolean;
  /** Prompts propios de esta persona (GET /me); sin ellos, los predeterminados. */
  suggestedPrompts?: Array<{ q: string; label: string }> | null;
}

export function AiSheet({ open, onOpen, onClose, onCreateWidget, idToken, businessName, profile, onReportSaved, hideDock, suggestedPrompts }: AiSheetProps) {
  const suggested = suggestedPrompts?.length ? suggestedPrompts : SUGGESTED;
  const { messages, typing, blocked, usageNotice, send } = useAssistantChat({ idToken, onCreateWidget, onReportSaved, businessName, profile });
  const [fontLevel, setFontLevel] = useFontLevel();
  const [input, setInput] = useState("");
  const [dockInput, setDockInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });
  }, [messages, typing]);

  function ask(question: string) {
    void send(question, () => { setInput(""); setDockInput(""); });
  }

  function submitDock() {
    if (!dockInput.trim()) { onOpen(); return; }
    onOpen();
    ask(dockInput);
  }

  return (
    <>
      {!open && !hideDock && (
        <div className="ai-dock glass">
          <div className="ai-dock-orb"><IconAi /></div>
          <input value={dockInput} onChange={(e) => setDockInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitDock(); }} placeholder="Preguntale a Innova sobre tu negocio…" aria-label="Pregunta a Innova" />
          <button onClick={submitDock} aria-label="Enviar a Innova"><IconSend /></button>
        </div>
      )}
      <section className={`sheet ai-sheet${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="sheet-handle" />
        <header className="ai-head">
          <div className="ai-head-title"><div className="ai-avatar"><IconAi /></div><div><div className="ai-title-text">Innova</div><div className="ai-subtitle"><span className="pulse-dot" /> Especialista de tu negocio</div></div></div>
          <TextSizeControl className="inline" level={fontLevel} onChange={setFontLevel} label="Tamaño del texto de Innova" />
          <button className="ai-close" onClick={onClose} aria-label="Cerrar Innova"><IconClose /></button>
        </header>
        <div className="ai-body" ref={bodyRef}>
          {messages.map((message) => <div className={`msg ${message.role}`} key={message.id}><div className="msg-avatar">{message.role === "ai" ? "IA" : "Tú"}</div><div className="msg-bubble"><ChatMessageContent message={message} businessName={businessName} /></div></div>)}
          {typing && <div className="msg ai"><div className="msg-avatar">IA</div><div className="msg-bubble"><div className="typing"><span /><span /><span /></div></div></div>}
        </div>
        <div className="suggested">{suggested.map((item) => <button className="chip" key={item.q} onClick={() => ask(item.q)}>{item.label}</button>)}</div>
        <div className="ai-usage" role="status" style={{ fontSize: "calc(12px * var(--afs, 1))", padding: "0 16px 6px", opacity: 0.75 }}>{usageNotice}</div>
        <div className="ai-input-wrap">
          <textarea className="ai-input" rows={1} placeholder={blocked ? "Esperá un momento para volver a preguntar…" : "Preguntale a Innova sobre tu negocio…"} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
          <button className="ai-send" onClick={() => ask(input)} aria-label="Enviar"><IconSend /></button>
        </div>
      </section>
    </>
  );
}
