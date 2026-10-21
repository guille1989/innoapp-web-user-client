import { useEffect, useRef, useState } from "react";
import { IconAi, IconClose, IconSend } from "../icons";
import { TextSizeControl } from "../dashboard/TextSizeControl";
import { useFontLevel } from "../dashboard/fontScale";
import { SUGGESTED, useAssistantChat } from "./useAssistantChat";
import type { Widget } from "../../types";

interface AiSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCreateWidget: (cfg: Omit<Widget, "id">) => Promise<void>;
  idToken: string;
  businessName: string;
  /** El backend guardó un reporte nuevo: la lista de Reportes y el widget del dashboard se refrescan. */
  onReportSaved: () => void;
  /** Oculta el campo flotante: la entrada al asistente es la vista IA. */
  hideDock?: boolean;
}

export function AiSheet({ open, onOpen, onClose, onCreateWidget, idToken, businessName, onReportSaved, hideDock }: AiSheetProps) {
  const { messages, typing, blocked, usageNotice, send } = useAssistantChat({ idToken, businessName, onCreateWidget, onReportSaved });
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
          <input value={dockInput} onChange={(e) => setDockInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitDock(); }} placeholder="Pregunta a tu agente sobre cualquier dato…" aria-label="Pregunta al asistente" />
          <button onClick={submitDock} aria-label="Enviar al asistente"><IconSend /></button>
        </div>
      )}
      <section className={`sheet ai-sheet${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="sheet-handle" />
        <header className="ai-head">
          <div className="ai-head-title"><div className="ai-avatar"><IconAi /></div><div><div className="ai-title-text">Asistente de datos</div><div className="ai-subtitle"><span className="pulse-dot" /> Datos sincronizados en tiempo real</div></div></div>
          <TextSizeControl className="inline" level={fontLevel} onChange={setFontLevel} label="Tamaño del texto del asistente" />
          <button className="ai-close" onClick={onClose} aria-label="Cerrar asistente"><IconClose /></button>
        </header>
        <div className="ai-body" ref={bodyRef}>
          {messages.map((message) => <div className={`msg ${message.role}`} key={message.id}><div className="msg-avatar">{message.role === "ai" ? "IA" : "Tú"}</div><div className="msg-bubble">{message.content}</div></div>)}
          {typing && <div className="msg ai"><div className="msg-avatar">IA</div><div className="msg-bubble"><div className="typing"><span /><span /><span /></div></div></div>}
        </div>
        <div className="suggested">{SUGGESTED.map((item) => <button className="chip" key={item.q} onClick={() => ask(item.q)}>{item.label}</button>)}</div>
        <div className="ai-usage" role="status" style={{ fontSize: "calc(12px * var(--afs, 1))", padding: "0 16px 6px", opacity: 0.75 }}>{usageNotice}</div>
        <div className="ai-input-wrap">
          <textarea className="ai-input" rows={1} placeholder={blocked ? "Esperá un momento para volver a preguntar…" : "Pregunta o pide un KPI…"} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
          <button className="ai-send" onClick={() => ask(input)} aria-label="Enviar"><IconSend /></button>
        </div>
      </section>
    </>
  );
}
