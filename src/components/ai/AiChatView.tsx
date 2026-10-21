import { useEffect, useRef, useState } from "react";
import { IconSend } from "../icons";
import { useFontLevel } from "../dashboard/fontScale";
import { SUGGESTED, useAssistantChat } from "./useAssistantChat";
import type { Widget } from "../../types";

interface AiChatViewProps {
  active: boolean;
  onCreateWidget: (cfg: Omit<Widget, "id">) => Promise<void>;
  idToken: string;
  businessName: string;
  onReportSaved: () => void;
}

/** Vista IA: conversación a pantalla completa con el asistente de datos (mismo backend que el panel flotante). */
export function AiChatView({ active, onCreateWidget, idToken, businessName, onReportSaved }: AiChatViewProps) {
  const { messages, typing, blocked, usageNotice, send } = useAssistantChat({ idToken, businessName, onCreateWidget, onReportSaved });
  const [input, setInput] = useState("");
  const [fontLevel] = useFontLevel();
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const started = messages.length > 1;
  // Las sugerencias rotan como placeholder mientras la conversación no ha empezado.
  const [hint, setHint] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });
  }, [messages, typing, active]);

  useEffect(() => {
    if (!active || started || input) return;
    const id = window.setInterval(() => setHint((i) => (i + 1) % SUGGESTED.length), 3500);
    return () => window.clearInterval(id);
  }, [active, started, input]);

  // El textarea crece con el texto hasta su max-height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    // Sin barra de scroll hasta que el texto supera el max-height del CSS.
    el.style.overflowY = el.scrollHeight > el.clientHeight + 1 ? "auto" : "hidden";
  }, [input, active, fontLevel]);

  function ask(question: string) {
    void send(question, () => setInput(""));
  }

  return (
    <section className={`ai-chat view${active ? " active" : ""}${started ? "" : " empty"}`} aria-label="Conversación con la IA">
      <div className="canvas-grid" />
      <div className="canvas-vignette" />
      {started
        ? (
          <div className="ai-chat-body" ref={bodyRef}>
            <div className="ai-chat-thread">
              {messages.map((message) => <div className={`msg ${message.role}`} key={message.id}><div className="msg-avatar">{message.role === "ai" ? "IA" : "Tú"}</div><div className="msg-bubble">{message.content}</div></div>)}
              {typing && <div className="msg ai"><div className="msg-avatar">IA</div><div className="msg-bubble"><div className="typing"><span /><span /><span /></div></div></div>}
            </div>
          </div>
        )
        : (
          <>
            <img className="ai-chat-logo" src="/brand/innoapp-logo-wordmark.png" alt="InnoApp" />
            <h1 className="ai-chat-hero">El poder de <span>tus datos</span> al alcance de tus manos</h1>
          </>
        )}
      <div className="ai-chat-composer">
        {usageNotice && <div className="ai-chat-usage" role="status">{usageNotice}</div>}
        <div className="ai-chat-input glass">
          <textarea ref={textareaRef} rows={1} placeholder={blocked ? "Esperá un momento para volver a preguntar…" : started ? "Pregunta a tu agente sobre cualquier dato…" : SUGGESTED[hint].q} aria-label="Mensaje para la IA" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
          <div className="ai-chat-tools">
            <button className="ai-send" onClick={() => ask(input)} aria-label="Enviar" disabled={!input.trim() || typing}><IconSend /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
