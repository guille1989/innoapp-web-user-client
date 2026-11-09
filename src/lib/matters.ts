import type { ApiMatter, ApiMatterSeverity } from "../api/client";

export const SEVERITY_LABEL: Record<ApiMatterSeverity, string> = { critical: "Crítico", warn: "Atención", info: "Aviso" };
const SEVERITY_RANK: Record<ApiMatterSeverity, number> = { info: 0, warn: 1, critical: 2 };

// Debe coincidir con MAX_QUESTION_LENGTH en ticket-parsing-cloud/src/assistant/askHandler.ts.
const MAX_QUESTION_LENGTH = 500;

/** Lo no visto primero; dentro de cada grupo lo más grave y, a igual gravedad, lo más reciente. */
export function sortMatters(matters: readonly ApiMatter[]): ApiMatter[] {
  return [...matters].sort((a, b) => {
    const unseen = Number(b.status === "new") - Number(a.status === "new");
    if (unseen !== 0) return unseen;
    const severity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severity !== 0) return severity;
    return a.periodDate < b.periodDate ? 1 : a.periodDate > b.periodDate ? -1 : 0;
  });
}

export function countUnseen(matters: readonly ApiMatter[]): number {
  return matters.filter((matter) => matter.status === "new").length;
}

/** Efecto inmediato de una acción de la persona, antes de que el servidor confirme: descartar lo quita; "visto" lo atenúa. */
export function applyMark(matters: readonly ApiMatter[], id: string, status: "seen" | "dismissed"): ApiMatter[] {
  if (status === "dismissed") return matters.filter((matter) => matter.id !== id);
  return matters.map((matter) => (matter.id === id ? { ...matter, status: "seen" } : matter));
}

/**
 * Pregunta corta al tocar "Preguntar" en un aviso. El detalle completo ya no
 * viaja pegado en el texto: el cliente manda `matterId` y el backend usa
 * explain_matter (evita el tope de 500 chars y alucinaciones sobre el aviso).
 */
export function questionAbout(matter: Pick<ApiMatter, "title">): string {
  return `Explícame este aviso y decime qué debería revisar primero: ${matter.title}`.trim().slice(0, MAX_QUESTION_LENGTH);
}
