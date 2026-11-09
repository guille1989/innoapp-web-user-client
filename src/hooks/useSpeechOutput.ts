import { useCallback, useEffect, useRef, useState } from "react";
import { pickVoice, splitSentences } from "../lib/speech";
import type { VoiceSettings } from "./useVoiceSettings";

/** Un valor 0-1 que el núcleo lee en cada fotograma sin provocar renders (volumen de la voz). */
export interface LevelRef { current: number }

/**
 * Innova hablando, con la voz del navegador. Lee frase por frase (Chrome corta los textos largos a los
 * ~15 s), late en el núcleo con cada palabra y se puede interrumpir con `cancel`.
 */
export function useSpeechOutput(levelRef: LevelRef, settings: VoiceSettings) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  /** Las frases que Innova ya empezó a decir en esta intervención (para mostrarlas escritas a la par). */
  const [said, setSaid] = useState<string[]>([]);
  const turn = useRef(0);
  const current = useRef(settings);
  current.current = settings;

  useEffect(() => {
    if (!synth) return;
    const load = () => setVoices(synth.getVoices().filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("es")));
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, [synth]);

  const cancel = useCallback(() => {
    turn.current++;
    synth?.cancel();
    levelRef.current = 0;
    setSpeaking(false);
    setSaid([]);
  }, [synth, levelRef]);

  /** Resuelve `true` si terminó de hablar y `false` si la interrumpieron o no pudo hablar. */
  const speak = useCallback((text: string): Promise<boolean> => {
    if (!synth || !text.trim()) return Promise.resolve(false);
    synth.cancel();
    const mine = ++turn.current;
    const parts = splitSentences(text);
    setSpeaking(true);
    setSaid([]);
    return new Promise<boolean>((resolve) => {
      let index = 0;
      const finish = (finished: boolean) => {
        if (turn.current === mine) { levelRef.current = 0; setSpeaking(false); }
        resolve(finished);
      };
      const next = () => {
        if (turn.current !== mine) return resolve(false);
        if (index >= parts.length) return finish(true);
        const part = parts[index++];
        setSaid(parts.slice(0, index));
        const { lang, voice: preferred, rate } = current.current;
        const utterance = new SpeechSynthesisUtterance(part);
        const voice = pickVoice(synth.getVoices(), lang, preferred);
        if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = lang;
        utterance.rate = rate;
        utterance.onboundary = () => {
          levelRef.current = 1;
          window.setTimeout(() => { if (turn.current === mine) levelRef.current = 0.25; }, 140);
        };
        // Chrome a veces no dispara `onend`: sin este seguro Innova se quedaría "hablando" para siempre.
        let advanced = false;
        let guard = 0;
        const advance = () => {
          if (advanced) return;
          advanced = true;
          window.clearTimeout(guard);
          next();
        };
        guard = window.setTimeout(advance, (part.length * 140 + 2500) / rate);
        utterance.onend = advance;
        utterance.onerror = advance;
        synth.speak(utterance);
      };
      next();
    });
  }, [synth, levelRef]);

  // Al salir de la vista, Innova se calla.
  useEffect(() => cancel, [cancel]);

  return { supported: Boolean(synth), voices, speaking, said, speak, cancel };
}
