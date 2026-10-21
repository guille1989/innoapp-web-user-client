import { useEffect, useRef, useState } from "react";
import { IconPlus, IconSend } from "../icons";
import { useFontLevel } from "../dashboard/fontScale";
import { useConversationList } from "../../hooks/useConversationList";
import { ChatMessageContent } from "./ChatMessageContent";
import { ConversationSidebar, IconSidebar } from "./ConversationSidebar";
import { SUGGESTED, useAssistantChat } from "./useAssistantChat";
import type { Widget } from "../../types";

interface AiChatViewProps {
  active: boolean;
  onCreateWidget: (cfg: Omit<Widget, "id">) => Promise<void>;
  idToken: string;
  businessName: string;
  onReportSaved: () => void;
}

// En pantallas angostas el historial es un panel que se superpone al chat (y se cierra al elegir algo).
const isNarrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;

/** Vista IA: conversación a pantalla completa con el asistente de datos, con el historial de conversaciones al lado. */
export function AiChatView({ active, onCreateWidget, idToken, businessName, onReportSaved }: AiChatViewProps) {
  const list = useConversationList(idToken);
  const { messages, typing, ready, blocked, usageNotice, activeId, send, startNewConversation, openConversation } = useAssistantChat({
    idToken, onCreateWidget, onReportSaved, persist: true, onConversationSaved: list.upsert,
  });
  const [input, setInput] = useState("");
  const [fontLevel] = useFontLevel();
  const [sideOpen, setSideOpen] = useState(() => !isNarrow());
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

  function newConversation() {
    startNewConversation();
    if (isNarrow()) setSideOpen(false);
  }

  function open(conversationId: string) {
    void openConversation(conversationId);
    if (isNarrow()) setSideOpen(false);
  }

  async function remove(conversationId: string) {
    await list.remove(conversationId);
    // Borrar la que está abierta deja la vista en blanco: no queda un hilo que el backend ya no tiene.
    if (conversationId === activeId) startNewConversation();
  }

  return (
    <section className={`ai-chat view${active ? " active" : ""}${started ? "" : " empty"}${ready ? "" : " loading"}`} aria-label="Conversación con la IA">
      <div className="canvas-grid" />
      <div className="canvas-vignette" />
      <ConversationSidebar
        open={sideOpen}
        items={list.items}
        loaded={list.loaded}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        activeId={activeId}
        onClose={() => setSideOpen(false)}
        onNew={newConversation}
        onOpen={open}
        onDelete={remove}
        onLoadMore={() => void list.loadMore()}
      />
      <div className="ai-chat-main">
        <div className="ai-chat-bar glass">
          <button type="button" onClick={() => setSideOpen((v) => !v)} aria-label={sideOpen ? "Ocultar el historial" : "Mostrar el historial"} aria-expanded={sideOpen} title={sideOpen ? "Ocultar el historial" : "Mostrar el historial"}><IconSidebar /></button>
          <button type="button" onClick={newConversation} aria-label="Nueva conversación" title="Nueva conversación"><IconPlus /></button>
        </div>
        {started
          ? (
            <div className="ai-chat-body" ref={bodyRef}>
              <div className="ai-chat-thread">
                {/* El saludo inicial (siempre el primero) solo acompaña a la vista en blanco, no a una conversación guardada. */}
                {messages.filter((message, i) => !(i === 0 && message.transient)).map((message) => <div className={`msg ${message.role}`} key={message.id}><div className="msg-avatar">{message.role === "ai" ? "IA" : "Tú"}</div><div className="msg-bubble"><ChatMessageContent message={message} businessName={businessName} /></div></div>)}
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
              <button className="ai-send" onClick={() => ask(input)} aria-label="Enviar" disabled={!input.trim() || typing || !ready}><IconSend /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
