import type { ApiMatter } from "../api/client";
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

/** Saludo de la portada: determinista, con el conteo de avisos que la persona todavía no vio. */
export function greetingFor(now: Date, matters: readonly ApiMatter[]): { headline: string; sub: string } {
  const unseen = countUnseen(matters);
  const sub = unseen === 0
    ? "Por ahora no hay nada que requiera tu atención. Pregúntame lo que necesites sobre tus datos."
    : unseen === 1
      ? "Hay 1 cosa que revisar. Pregúntame lo que necesites sobre tus datos."
      : `Hay ${unseen} cosas que revisar. Pregúntame lo que necesites sobre tus datos.`;
  return { headline: `${greetingWord(now.getHours())}. Soy ${ASSISTANT_NAME}.`, sub };
}
