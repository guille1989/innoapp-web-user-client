import { useMemo, useState } from "react";
import type { ApiMatter } from "../../api/client";
import { ASSISTANT_NAME, greetingFor, ORB_STATE_LABEL, orbStateFor } from "../../lib/innova";
import { AttentionPanel } from "../ai/AttentionPanel";
import { ChatMessageContent } from "../ai/ChatMessageContent";
import { useAssistantChat } from "../ai/useAssistantChat";
import { IconSend } from "../icons";
import type { Widget } from "../../types";
import { InnovaOrb } from "./InnovaOrb";

interface InnovaViewProps {
  active: boolean;
  idToken: string;
  businessName: string;
  onCreateWidget: (cfg: Omit<Widget, "id">) => Promise<void>;
  onReportSaved: () => void;
  /** Avisos del asesor del negocio; el mismo hook que alimenta el contador de la pestaña IA. */
  matters: ApiMatter[];
  onMark: (id: string, status: "seen" | "dismissed") => void;
  onOpenClassic: () => void;
}

/**
 * Innova (beta): el asistente con presencia. El núcleo muestra lo que está haciendo (reposo,
 * pensando, alerta), te saluda con lo importante y responde con el mismo asistente de datos del
 * chat clásico. Se ve solo en los negocios con el interruptor encendido. En esta primera versión la
 * conversación no se guarda: para eso está el chat clásico, que sigue intacto.
 */
export function InnovaView({ active, idToken, businessName, onCreateWidget, onReportSaved, matters, onMark, onOpenClassic }: InnovaViewProps) {
  const { messages, typing, ready, blocked, usageNotice, send, startNewConversation } = useAssistantChat({
    idToken, onCreateWidget, onReportSaved, persist: false,
  });
  const [input, setInput] = useState("");
  const [openedAt] = useState(() => new Date());
  const greeting = useMemo(() => greetingFor(openedAt, matters), [openedAt, matters]);

  const state = orbStateFor({ thinking: typing, matters });
  // messages[0] es el saludo del hook (el de Innova es el de arriba): lo que sigue es la conversación.
  const exchange = messages.slice(1);
  const lastQuestion = [...exchange].reverse().find((message) => message.role === "user");
  const lastAnswer = typing ? undefined : [...exchange].reverse().find((message) => message.role === "ai");

  function ask(question: string) {
    void send(question, () => setInput(""));
  }

  return (
    <section className={`innova view${active ? " active" : ""}${exchange.length > 0 ? " has-exchange" : ""}`} aria-label={ASSISTANT_NAME}>
      <div className="canvas-grid" />
      <div className="canvas-vignette" />
      <div className="innova-scroll">
        <div className="innova-head">
          <span className="innova-beta">{ASSISTANT_NAME} <em>beta</em></span>
          <button type="button" className="innova-link" onClick={onOpenClassic}>Ir al chat clásico</button>
        </div>

        <InnovaOrb state={state} />
        <p className="innova-status" data-state={state} role="status">{ORB_STATE_LABEL[state]}</p>
        <h1 className="innova-greeting">{greeting.headline}</h1>
        <p className="innova-sub">{greeting.sub}</p>

        {lastQuestion && <p className="innova-question">{lastQuestion.text}</p>}
        {lastAnswer && (
          <div className="innova-answer glass" aria-live="polite">
            <ChatMessageContent message={lastAnswer} businessName={businessName} />
          </div>
        )}
        {exchange.length > 0 && !typing && (
          <button type="button" className="innova-link" onClick={() => { startNewConversation(); setInput(""); }}>Empezar de nuevo</button>
        )}

        <AttentionPanel matters={matters} onAsk={ask} onMark={onMark} disabled={typing || !ready || blocked} />
      </div>

      <div className="innova-composer">
        {usageNotice && <div className="ai-chat-usage" role="status">{usageNotice}</div>}
        <form className="innova-input glass" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={blocked ? "Espera un momento para volver a preguntar…" : `Pregúntale a ${ASSISTANT_NAME} sobre tus datos…`}
            aria-label={`Mensaje para ${ASSISTANT_NAME}`}
          />
          <button type="submit" className="ai-send" aria-label="Enviar" disabled={!input.trim() || typing || !ready}><IconSend /></button>
        </form>
      </div>
    </section>
  );
}
