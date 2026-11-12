/**
 * Zona IANA del NEGOCIO (GET /me.timeZone = advisor.timeZone), la misma que
 * Ask y el dataHandler del backend. Sin ella, «hoy» y los periodos caen al
 * navegador — igual que Ask cuando el tenant no tiene zona configurada.
 */

let configured: string | undefined;

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Aplica la zona del negocio (GET /me.timeZone). null/undefined → navegador. */
export function configureBusinessTimeZone(timeZone?: string | null): void {
  if (typeof timeZone === "string" && timeZone.trim() && isValidTimeZone(timeZone.trim())) {
    configured = timeZone.trim();
    return;
  }
  configured = undefined;
}

/** Zona configurada del negocio, o undefined si hay que usar el navegador. */
export function businessTimeZone(): string | undefined {
  return configured;
}

/** Zona efectiva para fechas de periodo / «hoy»: negocio si hay, si no navegador. */
export function effectiveTimeZone(): string {
  return configured ?? browserTimeZone();
}
