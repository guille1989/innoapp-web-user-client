import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiMatter } from "../../api/client";
import { useSpeechInput } from "../../hooks/useSpeechInput";
import { useSpeechOutput } from "../../hooks/useSpeechOutput";
import { useVoiceSettings } from "../../hooks/useVoiceSettings";
import { ASSISTANT_NAME, briefingSpoken, greetingFor, ORB_STATE_LABEL, orbStateFor } from "../../lib/innova";
import { SPEECH_LANGS, speakableText } from "../../lib/speech";
import { AttentionPanel } from "../ai/AttentionPanel";
import { ChatMessageContent } from "../ai/ChatMessageContent";
import { useAssistantChat } from "../ai/useAssistantChat";
import { IconAi, IconSend } from "../icons";
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
 * escuchando, pensando, hablando, alerta), te saluda con lo importante y responde con el mismo
 * asistente de datos del chat clásico. Se le puede hablar (Chrome y Edge) y contesta en voz alta
 * cuando le hablas; escribiendo, responde en silencio. Se ve solo en los negocios con el
 * interruptor encendido. La conversación no se guarda: para eso está el chat clásico, que sigue intacto.
 */
export function InnovaView({ active, idToken, businessName, onCreateWidget, onReportSaved, matters, onMark, onOpenClassic }: InnovaViewProps) {
  const { messages, typing, ready, blocked, usageNotice, send, startNewConversation } = useAssistantChat({
    idToken, onCreateWidget, onReportSaved, persist: false,
  });
  const [input, setInput] = useState("");
  const [openedAt] = useState(() => new Date());
  const greeting = useMemo(() => greetingFor(openedAt, matters), [openedAt, matters]);

  // Voz: el núcleo late con el volumen (micrófono o voz de Innova) leído desde este ref.
  const levelRef = useRef(0);
  const [voice, setVoice] = useVoiceSettings();
  const speech = useSpeechOutput(levelRef, voice);
  const voiceTurn = useRef(false);   // la pregunta en curso se dijo hablando: la respuesta se lee en voz alta

  const state = orbStateFor({ thinking: typing, matters, speaking: speech.speaking, listening: false });
  // messages[0] es el saludo del hook (el de Innova es el de arriba): lo que sigue es la conversación.
  const exchange = messages.slice(1);
  const lastQuestion = [...exchange].reverse().find((message) => message.role === "user");
  const lastAnswer = typing ? undefined : [...exchange].reverse().find((message) => message.role === "ai");
  const latest = useRef({ messages, voice, speech });
  latest.current = { messages, voice, speech };

  /** `spoken`: la pregunta se dijo hablando, así que la respuesta se lee en voz alta; escrita, responde en silencio. */
  function ask(question: string, spoken = false) {
    speech.cancel();
    voiceTurn.current = spoken;
    void send(question, () => setInput(""));
  }

  const listen = useSpeechInput({
    lang: voice.lang,
    levelRef,
    onFinal: (text) => ask(text, true),
  });
  const orbState = listen.listening ? "listening" : state;

  // Cuando llega la respuesta a una pregunta hablada, Innova la lee; en manos libres vuelve a escuchar.
  const wasTyping = useRef(false);
  useEffect(() => {
    if (wasTyping.current && !typing && voiceTurn.current) {
      voiceTurn.current = false;
      const { messages: all, voice: settings, speech: out } = latest.current;
      const answer = [...all].reverse().find((message) => message.role === "ai");
      if (answer && settings.readAloud && out.supported) {
        void out.speak(speakableText(answer.text)).then((finished) => {
          if (finished && latest.current.voice.handsFree) listen.start();
        });
      } else if (settings.handsFree) {
        listen.start();
      }
    }
    wasTyping.current = typing;
    // Solo reacciona a que la respuesta termine de llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);

  // Al salir de la pestaña, Innova se calla y deja de escuchar. Con Escape, también.
  useEffect(() => {
    if (!active) { speech.cancel(); listen.abort(); return; }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { speech.cancel(); listen.abort(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Las funciones de los hooks son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function toggleListening() {
    if (listen.listening) { listen.stop(); return; }
    speech.cancel();
    listen.start();
  }

  /** El núcleo es también el botón de hablar: lo tocas para callar a Innova o para decirle algo. */
  function onOrbClick() {
    if (speech.speaking || typing) { speech.cancel(); return; }
    toggleListening();
  }

  const hint = listen.interim || (listen.listening ? "" : lastQuestion?.text);
  const orbLabel = listen.listening ? "Dejar de escuchar" : speech.speaking ? "Callar a Innova" : "Hablar con Innova";

  return (
    <section className={`innova view${active ? " active" : ""}${exchange.length > 0 ? " has-exchange" : ""}`} aria-label={ASSISTANT_NAME}>
      <div className="canvas-grid" />
      <div className="canvas-vignette" />
      <div className="innova-scroll">
        <div className="innova-head">
          <span className="innova-beta">{ASSISTANT_NAME} <em>beta</em></span>
          <button type="button" className="innova-link" onClick={onOpenClassic}>Ir al chat clásico</button>
        </div>

        <button type="button" className="innova-orb-btn" onClick={onOrbClick} aria-label={orbLabel} title={orbLabel}>
          <InnovaOrb state={orbState} levelRef={levelRef} />
        </button>
        <p className="innova-status" data-state={orbState} role="status">{ORB_STATE_LABEL[orbState]}</p>
        <h1 className="innova-greeting">{greeting.headline}</h1>
        <p className="innova-sub">{greeting.sub}</p>
        {speech.supported && !speech.speaking && (
          <button type="button" className="innova-link" onClick={() => void speech.speak(briefingSpoken(greeting, matters))}>Escuchar el resumen</button>
        )}

        {listen.error && <p className="innova-error" role="alert">{listen.error}</p>}
        {hint && <p className={`innova-question${listen.listening ? " live" : ""}`}>{hint}</p>}
        {lastAnswer && (
          <div className="innova-answer glass" aria-live="polite">
            <ChatMessageContent message={lastAnswer} businessName={businessName} />
          </div>
        )}
        {exchange.length > 0 && !typing && (
          <div className="innova-after">
            {speech.supported && <button type="button" className="innova-link" onClick={() => lastAnswer && void speech.speak(speakableText(lastAnswer.text))}>Escuchar la respuesta</button>}
            <button type="button" className="innova-link" onClick={() => { speech.cancel(); startNewConversation(); setInput(""); }}>Empezar de nuevo</button>
          </div>
        )}

        <AttentionPanel matters={matters} onAsk={ask} onMark={onMark} disabled={typing || !ready || blocked} />
      </div>

      <div className="innova-composer">
        {usageNotice && <div className="ai-chat-usage" role="status">{usageNotice}</div>}
        {!listen.supported && <div className="ai-chat-usage">Para hablarle a {ASSISTANT_NAME} usa Chrome o Edge. Mientras tanto puedes escribirle.</div>}
        <form className="innova-input glass" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <button
            type="button"
            className="innova-mic"
            aria-pressed={listen.listening}
            aria-label={listen.listening ? "Dejar de escuchar" : `Hablar con ${ASSISTANT_NAME}`}
            title={listen.supported ? undefined : "Tu navegador no permite el reconocimiento de voz"}
            disabled={!listen.supported || !ready || blocked}
            onClick={toggleListening}
          >
            <IconAi />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={blocked ? "Espera un momento para volver a preguntar…" : `Pregúntale a ${ASSISTANT_NAME} sobre tus datos…`}
            aria-label={`Mensaje para ${ASSISTANT_NAME}`}
          />
          <button type="submit" className="ai-send" aria-label="Enviar" disabled={!input.trim() || typing || !ready}><IconSend /></button>
          <details className="innova-settings">
            <summary aria-label="Ajustes de voz" title="Ajustes de voz">Voz</summary>
            <div className="innova-settings-pop">
              <label>Idioma con que te escucho
                <select value={voice.lang} onChange={(e) => setVoice({ lang: e.target.value })}>
                  {SPEECH_LANGS.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
                </select>
              </label>
              <label>Voz de {ASSISTANT_NAME}
                <select value={speech.voices.some((v) => v.name === voice.voice) ? voice.voice : ""} onChange={(e) => setVoice({ voice: e.target.value })} disabled={!speech.supported}>
                  <option value="">La mejor disponible</option>
                  {speech.voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </label>
              <label>Velocidad
                <input type="range" min="0.8" max="1.4" step="0.05" value={voice.rate} onChange={(e) => setVoice({ rate: Number(e.target.value) })} />
              </label>
              <label className="check"><input type="checkbox" checked={voice.readAloud} onChange={(e) => setVoice({ readAloud: e.target.checked })} /> Leer la respuesta en voz alta cuando pregunto hablando</label>
              <label className="check"><input type="checkbox" checked={voice.handsFree} onChange={(e) => setVoice({ handsFree: e.target.checked })} /> Manos libres: volver a escuchar al terminar de hablar</label>
            </div>
          </details>
        </form>
      </div>
    </section>
  );
}
