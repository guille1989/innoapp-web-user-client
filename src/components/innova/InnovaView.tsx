import { useEffect, useRef } from "react";
import type { ApiBusinessProfile, ApiMatter } from "../../api/client";
import { useSpeechInput } from "../../hooks/useSpeechInput";
import { useSpeechOutput } from "../../hooks/useSpeechOutput";
import { useVoiceSettings } from "../../hooks/useVoiceSettings";
import { ASSISTANT_NAME, ORB_STATE_LABEL, orbStateFor } from "../../lib/innova";
import { countUnseen } from "../../lib/matters";
import { SPEECH_LANGS, speakableText } from "../../lib/speech";
import { useAssistantChat } from "../ai/useAssistantChat";
import type { Widget } from "../../types";
import { InnovaOrb } from "./InnovaOrb";
import { InnovaSpeech } from "./InnovaSpeech";

/** Líneas de datos del diseño: dos hilos verticales con destellos que caen. Solo decoración. */
const DataStream = ({ side }: { side: "left" | "right" }) => (
  <div className={`innova-stream innova-stream--${side}`} aria-hidden="true"><span /><span /><span /></div>
);

interface InnovaViewProps {
  active: boolean;
  idToken: string;
  onCreateWidget: (cfg: Omit<Widget, "id">) => Promise<void>;
  onReportSaved: () => void;
  /** Avisos del asesor del negocio: solo marcan el estado del núcleo y el contador; aquí no se listan. */
  matters: ApiMatter[];
  onOpenClassic: () => void;
  businessName?: string;
  profile?: ApiBusinessProfile | null;
}

/**
 * Innova (beta): solo voz. El núcleo animado ocupa el centro de la pantalla y muestra lo que está
 * haciendo (reposo, escuchando, pensando, hablando, alerta). Se le toca para hablarle (Chrome y Edge)
 * y contesta en voz alta con el mismo asistente de datos del chat clásico. Mientras habla, el núcleo
 * se adelanta y arriba a la derecha aparece lo que dice, como el chat de un videojuego; no hay campo
 * para escribir. Se ve solo en los negocios con el interruptor encendido. La conversación no
 * se guarda: para leerla o escribirle está el chat clásico, que sigue intacto.
 */
export function InnovaView({ active, idToken, onCreateWidget, onReportSaved, matters, onOpenClassic, businessName, profile }: InnovaViewProps) {
  const { messages, typing, ready, blocked, usageNotice, send } = useAssistantChat({
    idToken, onCreateWidget, onReportSaved, persist: false, businessName, profile,
  });
  // Voz: el núcleo late con el volumen (micrófono o voz de Innova) leído desde este ref.
  const levelRef = useRef(0);
  const [voice, setVoice] = useVoiceSettings();
  const speech = useSpeechOutput(levelRef, voice);

  const state = orbStateFor({ thinking: typing, matters, speaking: speech.speaking, listening: false });
  const latest = useRef({ messages, voice, speech });
  latest.current = { messages, voice, speech };

  /** Todo lo que se le pregunta es hablado: la respuesta se lee en voz alta. */
  function ask(question: string) {
    speech.cancel();
    void send(question);
  }

  const listen = useSpeechInput({
    lang: voice.lang,
    levelRef,
    onFinal: ask,
  });
  const orbState = listen.listening ? "listening" : state;

  // Cuando llega la respuesta, Innova la lee; en manos libres vuelve a escuchar.
  const wasTyping = useRef(false);
  useEffect(() => {
    if (wasTyping.current && !typing) {
      const { messages: all, voice: settings, speech: out } = latest.current;
      const answer = [...all].reverse().find((message) => message.role === "ai");
      if (answer && out.supported) {
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
    if (!ready || blocked) return;
    toggleListening();
  }

  const unseen = countUnseen(matters);
  const orbLabel = listen.listening ? "Dejar de escuchar" : speech.speaking ? "Callar a Innova" : "Hablar con Innova";

  return (
    <section className={`innova view${active ? " active" : ""}${speech.speaking ? " is-speaking" : ""}`} aria-label={ASSISTANT_NAME}>
      <div className="canvas-grid" />
      <div className="canvas-vignette" />
      <div className="innova-glow" aria-hidden="true" />
      <DataStream side="left" />
      <DataStream side="right" />
      <div className="innova-head">
        <span className="innova-beta">{ASSISTANT_NAME} <em>beta</em></span>
        <div className="innova-head-actions">
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
              <label className="check"><input type="checkbox" checked={voice.handsFree} onChange={(e) => setVoice({ handsFree: e.target.checked })} /> Manos libres: volver a escuchar al terminar de hablar</label>
            </div>
          </details>
          <button type="button" className="innova-link" onClick={onOpenClassic}>Ir al chat clásico <span aria-hidden="true">↗</span></button>
        </div>
      </div>

      <InnovaSpeech said={speech.said} speaking={speech.speaking} rate={voice.rate} />

      <div className="innova-center">
        <div className="innova-stage">
          <div className="innova-telemetry innova-telemetry--left" aria-hidden="true">
            <small>ENTRADA</small>
            <strong>{listen.supported ? "VOZ" : "NO DISPONIBLE"}</strong>
            <span>{listen.supported ? voice.lang : "USA CHROME, EDGE O SAFARI"}</span>
          </div>
          <div className="innova-telemetry innova-telemetry--right" aria-hidden="true">
            <small>AVISOS</small>
            <strong>{String(unseen).padStart(2, "0")}</strong>
            <span>{unseen === 0 ? "AL DÍA" : "POR REVISAR"}</span>
          </div>
          <button type="button" className="innova-orb-btn" onClick={onOrbClick} aria-label={orbLabel} title={orbLabel} aria-pressed={listen.listening}>
            <InnovaOrb state={orbState} levelRef={levelRef} />
          </button>
        </div>
        <p className="innova-status" data-state={orbState} role="status"><i aria-hidden="true" />{ORB_STATE_LABEL[orbState]}<i aria-hidden="true" /></p>
        {listen.error && <p className="innova-error" role="alert">{listen.error}</p>}
        {usageNotice && <p className="innova-error" role="status">{usageNotice}</p>}
      </div>
    </section>
  );
}
