import type { ApiBusinessProfile, ApiMatter } from "../api/client";
import { profileCopyHint } from "./businessProfile";
import { countUnseen } from "./matters";

/** Nombre visible del asistente. Vive solo acá (y en los textos de la vista): el código y la API lo llaman `advisor`. */
export const ASSISTANT_NAME = "Innova";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "alert";

export const ORB_STATE_LABEL: Record<OrbState, string> = {
  idle: "En reposo",
  listening: "Escuchando…",
  thinking: "Pensando…",
  speaking: "Hablando",
  alert: "Tiene algo importante que decirte",
};

/**
 * Estado del núcleo. Responder o escuchar manda sobre todo; en reposo, un aviso crítico que la
 * persona todavía no vio lo pone en alerta (ámbar) hasta que lo marque como visto o lo descarte.
 */
export function orbStateFor(opts: { thinking: boolean; listening?: boolean; speaking?: boolean; matters: readonly ApiMatter[] }): OrbState {
  if (opts.thinking) return "thinking";
  if (opts.speaking) return "speaking";
  if (opts.listening) return "listening";
  return opts.matters.some((m) => m.severity === "critical" && m.status === "new") ? "alert" : "idle";
}

export function greetingWord(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

// Más de tres avisos en voz alta es un monólogo: se leen los más urgentes y el resto queda en pantalla.
const MAX_SPOKEN_MATTERS = 3;

/** Lo que Innova dice al tocar "Escuchar" en el saludo: el saludo y los avisos nuevos más urgentes (el orden de `matters` ya es por gravedad). */
export function briefingSpoken(greeting: { headline: string; sub: string }, matters: readonly ApiMatter[]): string {
  const unseen = matters.filter((m) => m.status === "new");
  const spoken = unseen.slice(0, MAX_SPOKEN_MATTERS).map((m) => m.spoken || `${m.title}.`);
  const rest = unseen.length - spoken.length;
  return [
    greeting.headline,
    unseen.length === 0 ? greeting.sub : "",
    ...spoken,
    rest > 0 ? `Y ${rest === 1 ? "hay 1 más" : `hay ${rest} más`} en pantalla.` : "",
  ].filter(Boolean).join(" ");
}

/** Saludo de la portada: determinista, con el conteo de avisos y el nombre del negocio si existe. */
export function greetingFor(
  now: Date,
  matters: readonly ApiMatter[],
  businessName?: string,
  profile?: ApiBusinessProfile | null,
): { headline: string; sub: string } {
  const unseen = countUnseen(matters);
  const where = businessName?.trim() ? businessName.trim() : "tu negocio";
  const hint = profileCopyHint(profile);
  const base = unseen === 0
    ? `Por ahora no hay nada que requiera tu atención. Preguntame lo que necesites sobre ${where}.`
    : unseen === 1
      ? `Hay 1 cosa que revisar. Preguntame lo que necesites sobre ${where}.`
      : `Hay ${unseen} cosas que revisar. Preguntame lo que necesites sobre ${where}.`;
  return { headline: `${greetingWord(now.getHours())}. Soy ${ASSISTANT_NAME}.`, sub: `${base}${hint}` };
}
