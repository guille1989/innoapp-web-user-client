/** Lo mínimo que se necesita de una voz del navegador (SpeechSynthesisVoice cumple esta forma). */
export interface VoiceInfo {
  name: string;
  lang: string;
}

// Una respuesta hablada que dura más de unos 25 s cansa: se lee un resumen y el detalle queda en pantalla.
const MAX_SPOKEN_CHARS = 380;
const DETAIL_NOTE = "El detalle está en pantalla.";

export const SPEECH_LANGS = ["es-CO", "es-ES", "es-MX", "es-AR"] as const;

/** El idioma del navegador si es español de los que ofrecemos; si no, es-CO. */
export function defaultLang(navigatorLang: string | undefined): string {
  const match = SPEECH_LANGS.find((lang) => lang.toLowerCase() === navigatorLang?.toLowerCase());
  return match ?? "es-CO";
}

/**
 * Parte en frases por un punto (o ! ? …) seguido de espacio. Un punto pegado a un número ("5.224")
 * no corta: así una cifra con separador de miles no se parte en dos.
 */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

/**
 * Lo que Innova dice en voz alta de una respuesta del asistente (markdown): sin negritas, viñetas
 * ni tablas, y recortado a unas pocas frases. Si dejó algo fuera avisa que el detalle está en pantalla.
 */
export function speakableText(markdown: string): string {
  let hadTable = false;
  const lines: string[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("|")) { hadTable = true; continue; }
    const clean = line
      .replace(/^#+\s*/, "")
      .replace(/^(?:[-*•]|\d+[.)])\s+/, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/`/g, "");
    if (clean) lines.push(/[.!?…:]$/.test(clean) ? clean : `${clean}.`);
  }

  const kept: string[] = [];
  let length = 0;
  let truncated = false;
  for (const sentence of splitSentences(lines.join(" "))) {
    if (kept.length > 0 && length + sentence.length > MAX_SPOKEN_CHARS) { truncated = true; break; }
    kept.push(sentence);
    length += sentence.length + 1;
  }
  if (kept.length === 0) return hadTable ? "Te dejé el detalle en pantalla." : "";
  return [...kept, ...(hadTable || truncated ? [DETAIL_NOTE] : [])].join(" ");
}

/**
 * La mejor voz en español disponible: la elegida a mano si existe; si no, la que coincide con el
 * idioma y suena más natural (las "Natural" de Edge y las de Google superan a las básicas del sistema).
 */
export function pickVoice<T extends VoiceInfo>(voices: readonly T[], lang: string, preferred?: string): T | null {
  const spanish = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("es"));
  if (preferred) {
    const chosen = spanish.find((voice) => voice.name === preferred);
    if (chosen) return chosen;
  }
  const score = (voice: T) =>
    (voice.lang.toLowerCase().replace("_", "-") === lang.toLowerCase() ? 3 : 0) +
    (/natural|neural|online/i.test(voice.name) ? 4 : 0) +
    (/google/i.test(voice.name) ? 2 : 0) +
    (/microsoft/i.test(voice.name) ? 1 : 0);
  return [...spanish].sort((a, b) => score(b) - score(a))[0] ?? null;
}
