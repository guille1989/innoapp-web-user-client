/**
 * El refresco del dashboard pide varios recursos a la vez (actividad, cola de
 * revisión, robots, códigos, widgets). Cada uno debe actualizarse por su cuenta:
 * que uno falle no puede descartar las respuestas correctas de los demás.
 */
export type RefreshResource = "tickets" | "review" | "agents" | "codes" | "widgets";

export type RefreshFailures = Partial<Record<RefreshResource, string>>;

const RESOURCE_LABELS: Record<RefreshResource, string> = {
  tickets: "la actividad",
  review: "la cola de revisión",
  agents: "los robots",
  codes: "los códigos de activación",
  widgets: "los widgets",
};

/**
 * Espera a TODAS las peticiones (no corta en la primera que falla, como hace
 * `Promise.all`) y devuelve solo los fallos, por recurso. Cada petición ya
 * aplicó su propio resultado al resolverse; esto solo reúne los errores.
 */
export async function collectFailures(requests: Record<RefreshResource, Promise<unknown>>): Promise<RefreshFailures> {
  const entries = Object.entries(requests) as [RefreshResource, Promise<unknown>][];
  const settled = await Promise.allSettled(entries.map(([, request]) => request));
  const failures: RefreshFailures = {};
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      const reason = result.reason;
      failures[entries[index][0]] = reason instanceof Error ? reason.message : String(reason);
    }
  });
  return failures;
}

/** Texto para el aviso del dashboard: qué secciones no se pudieron actualizar y por qué. */
export function summarizeFailures(failures: RefreshFailures): string | null {
  const keys = (Object.keys(RESOURCE_LABELS) as RefreshResource[]).filter((key) => failures[key] !== undefined);
  if (keys.length === 0) return null;
  const labels = keys.map((key) => RESOURCE_LABELS[key]);
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
  return `No se pudo actualizar ${list}: ${failures[keys[0]]}`;
}
