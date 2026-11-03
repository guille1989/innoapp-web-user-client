import { useCallback, useState } from "react";
import { defaultLang } from "../lib/speech";

const STORAGE_KEY = "innoapp.innova-voice.v1";

export interface VoiceSettings {
  /** Idioma con que se escucha (y con que se elige la voz). */
  lang: string;
  /** Nombre de la voz elegida a mano; vacío = la mejor disponible. */
  voice: string;
  rate: number;
  /** Leer en voz alta la respuesta cuando la pregunta fue hablada. */
  readAloud: boolean;
  /** Al terminar de hablar, volver a escuchar sola. */
  handsFree: boolean;
}

function load(): VoiceSettings {
  const defaults: VoiceSettings = {
    lang: defaultLang(typeof navigator === "undefined" ? undefined : navigator.language),
    voice: "",
    rate: 1.05,
    readAloud: true,
    handsFree: false,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<VoiceSettings>;
    return {
      lang: typeof saved.lang === "string" ? saved.lang : defaults.lang,
      voice: typeof saved.voice === "string" ? saved.voice : defaults.voice,
      rate: typeof saved.rate === "number" && saved.rate >= 0.7 && saved.rate <= 1.5 ? saved.rate : defaults.rate,
      readAloud: typeof saved.readAloud === "boolean" ? saved.readAloud : defaults.readAloud,
      handsFree: typeof saved.handsFree === "boolean" ? saved.handsFree : defaults.handsFree,
    };
  } catch {
    return defaults;
  }
}

/** Preferencias de voz de quien mira (viven en este navegador, como el tema y el tamaño del texto). */
export function useVoiceSettings(): [VoiceSettings, (patch: Partial<VoiceSettings>) => void] {
  const [settings, setSettings] = useState<VoiceSettings>(load);
  const update = useCallback((patch: Partial<VoiceSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* sin storage: se pierde al recargar */ }
      return next;
    });
  }, []);
  return [settings, update];
}
