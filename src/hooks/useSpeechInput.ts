import { useCallback, useEffect, useRef, useState } from "react";
import type { LevelRef } from "./useSpeechOutput";

// El reconocimiento de voz del navegador no está en lib.dom de forma estable: se tipa lo que se usa.
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** iPhone/iPad (incluido el iPad que se hace pasar por Mac). */
const IS_IOS = typeof navigator !== "undefined"
  && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** Chrome, Firefox o Edge en iPhone: son Safari por dentro y iOS les suele negar el reconocimiento de voz. */
const IS_IOS_THIRD_PARTY = IS_IOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

// En iOS el permiso del micrófono de la web no basta: el reconocimiento de voz lo hace Siri, y se
// bloquea si el dictado está apagado o si la voz se pidió sin que el usuario tocara nada.
const ERRORS: Record<string, string> = IS_IOS ? {
  "not-allowed": "iOS bloqueó el micrófono. Toca el núcleo de nuevo; si sigue, revisa Ajustes › Safari › Micrófono (Permitir) y Ajustes › Privacidad y seguridad › Reconocimiento de voz.",
  "service-not-allowed": "iOS bloqueó el reconocimiento de voz. Activa el dictado en Ajustes › General › Teclado › Activar dictado (y Siri en Ajustes › Siri).",
  "no-speech": "No te escuché. Toca el núcleo e inténtalo de nuevo.",
  "audio-capture": "No encuentro ningún micrófono.",
  network: "El reconocimiento de voz necesita conexión a internet.",
} : {
  "not-allowed": "Necesito permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.",
  "service-not-allowed": "El navegador bloqueó el reconocimiento de voz.",
  "no-speech": "No te escuché. Toca el micrófono e inténtalo de nuevo.",
  "audio-capture": "No encuentro ningún micrófono.",
  network: "El reconocimiento de voz necesita conexión a internet.",
};

interface SpeechInputOptions {
  lang: string;
  levelRef: LevelRef;
  /** Lo que dijiste, ya terminado. */
  onFinal: (text: string) => void;
}

/**
 * Escuchar al usuario (Chrome y Edge). Mientras escucha, mide el volumen del micrófono para que el
 * núcleo reaccione a la voz. Cada vez se escucha una sola frase: al terminar de hablar, entrega el texto.
 */
export function useSpeechInput({ lang, levelRef, onFinal }: SpeechInputOptions) {
  const Ctor = recognitionCtor();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const stopMeter = useRef<(() => void) | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const releaseMeter = useCallback(() => {
    stopMeter.current?.();
    stopMeter.current = null;
    levelRef.current = 0;
  }, [levelRef]);

  const startMeter = useCallback(async () => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let raf = 0;
    stopMeter.current = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const value of buffer) { const d = (value - 128) / 128; sum += d * d; }
        levelRef.current = Math.min(1, Math.sqrt(sum / buffer.length) * 5);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      levelRef.current = 0; // sin medidor el núcleo late igual; el reconocimiento informa su propio error
    }
  }, [levelRef]);

  const start = useCallback(() => {
    if (!Ctor || recognition.current) return;
    setError(null);
    setInterim("");
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (event) => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript; else partial += result[0].transcript;
      }
      setInterim((finalText + partial).trim());
      if (IS_IOS) { // sin medidor de micrófono: pulso mientras llegan palabras
        levelRef.current = 0.7;
        window.setTimeout(() => { if (recognition.current === rec) levelRef.current = 0.25; }, 160);
      }
    };
    rec.onerror = (event) => {
      if (event.error === "aborted") return;
      if (IS_IOS_THIRD_PARTY && (event.error === "service-not-allowed" || event.error === "not-allowed")) {
        setError("Este navegador no puede usar la voz en iPhone. Abre app.theinnoapp.com en Safari y vuelve a tocar el núcleo.");
        return;
      }
      setError(ERRORS[event.error] ?? `No pude escucharte (${event.error}).`);
    };
    rec.onend = () => {
      recognition.current = null;
      releaseMeter();
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (text) finalRef.current(text);
    };
    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
      // En iOS el reconocimiento y getUserMedia se disputan el micrófono: abrir los dos a la vez
      // hace que Safari bloquee uno (o vuelva a pedir permiso). Allí el núcleo late con el texto oído.
      if (!IS_IOS) void startMeter();
    } catch {
      recognition.current = null;
      setError("No pude empezar a escuchar. Inténtalo de nuevo.");
    }
  }, [Ctor, lang, releaseMeter, startMeter]);

  /** Termina de escuchar y entrega lo que alcanzó a oír. */
  const stop = useCallback(() => { recognition.current?.stop(); }, []);

  /** Deja de escuchar y descarta lo oído (al interrumpir o al salir de la vista). */
  const abort = useCallback(() => {
    const rec = recognition.current;
    if (!rec) return;
    rec.onresult = null; rec.onerror = null; rec.onend = null;
    try { rec.abort(); } catch { /* ya terminó */ }
    recognition.current = null;
    releaseMeter();
    setListening(false);
    setInterim("");
  }, [releaseMeter]);

  useEffect(() => abort, [abort]);

  return { supported: Boolean(Ctor), listening, interim, error, clearError: () => setError(null), start, stop, abort };
}
