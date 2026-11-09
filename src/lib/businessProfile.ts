import type { ApiBusinessProfile } from "../api/client";

const WEEKDAY_LABEL: Record<string, string> = {
  "1": "lun",
  "2": "mar",
  "3": "mié",
  "4": "jue",
  "5": "vie",
  "6": "sáb",
  "7": "dom",
};

/** Resumen corto de horarios para copy de UI (saludos / settings). */
export function openingHoursSummary(openingHours: ApiBusinessProfile["openingHours"]): string | null {
  if (!openingHours) return null;
  const parts: string[] = [];
  if (openingHours.default) {
    parts.push(`${openingHours.default.open}–${openingHours.default.close}`);
  }
  if (openingHours.byWeekday) {
    for (const day of ["1", "2", "3", "4", "5", "6", "7"] as const) {
      const value = openingHours.byWeekday[day];
      if (value === undefined) continue;
      const label = WEEKDAY_LABEL[day] ?? day;
      parts.push(value === "closed" ? `${label} cerrado` : `${label} ${value.open}–${value.close}`);
    }
  }
  return parts.length ? parts.join("; ") : null;
}

/**
 * Fragmento de copy para saludos de Innova / chat: moneda y horarios solo si
 * están cargados en la ficha.
 */
export function profileCopyHint(profile?: ApiBusinessProfile | null): string {
  if (!profile) return "";
  const bits: string[] = [];
  if (profile.currency?.trim()) bits.push(`montos en ${profile.currency.trim()}`);
  const hours = openingHoursSummary(profile.openingHours);
  if (hours) bits.push(`horario ${hours}`);
  if (!bits.length) return "";
  return ` Sé que operás con ${bits.join(" y ")}.`;
}
