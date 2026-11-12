import { useSyncExternalStore } from "react";
import { isCalendarUnit, RANGE_LABELS, resolveRange, shortRangeLabel, tickLabel, UNIT_MONTHS, type CalendarUnit, type RangePreset } from "./chartScale";

/**
 * Período de tiempo que comparten todos los widgets de la vista de Datos. Es
 * temporal a propósito: vive solo en memoria, así que al recargar vuelve a
 * "Mes" (a diferencia del tamaño del texto, que sí se guarda). Lo lee
 * `useCloudData` para pedir los datos ya filtrados y los gráficos para rotularse.
 */
export interface PeriodFilter {
  preset: RangePreset;
  from?: string;
  to?: string;
  /**
   * Solo con mes/trimestre/semestre: primer mes del periodo elegido ("2026-10" para octubre,
   * "2026-07" para el 3.er trimestre o el 2.º semestre). Sin él, el periodo en curso.
   */
  anchor?: string;
}

export const DEFAULT_PERIOD: PeriodFilter = { preset: "month" };

let current: PeriodFilter = DEFAULT_PERIOD;
const listeners = new Set<() => void>();

function setPeriod(next: PeriodFilter) {
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function usePeriod() {
  const period = useSyncExternalStore(subscribe, () => current, () => DEFAULT_PERIOD);
  return [period, setPeriod] as const;
}

/**
 * Fechas efectivas del período, o `null` para "Todo" (sin filtro). Se resuelve
 * al llamar: "Mes" sigue a "hoy" si la pestaña cruza la medianoche.
 */
export function periodRange(period: PeriodFilter): { from: string; to: string } | null {
  if (period.preset === "all") return null;
  return resolveRange(period.preset, period, undefined, undefined);
}

const MONTH_NAME = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

/** "octubre de 2026", "3.er trimestre de 2026", "2.º semestre de 2026". */
export function unitLabel(unit: CalendarUnit, anchor: string): string {
  const year = anchor.slice(0, 4);
  const number = Math.floor((Number(anchor.slice(5, 7)) - 1) / UNIT_MONTHS[unit]) + 1;
  if (unit === "month") return MONTH_NAME.format(new Date(`${anchor}-01T00:00:00Z`));
  const ordinal = number === 1 ? "1.er" : number === 3 ? "3.er" : `${number}.º`;
  return `${ordinal} ${unit === "quarter" ? "trimestre" : "semestre"} de ${year}`;
}

/** Texto corto para el botón: "oct 26", "T3 26", "S2 26". */
export function unitShortLabel(unit: CalendarUnit, anchor: string): string {
  const yy = anchor.slice(2, 4);
  const number = Math.floor((Number(anchor.slice(5, 7)) - 1) / UNIT_MONTHS[unit]) + 1;
  if (unit === "month") return tickLabel(`${anchor}-01`, "month");
  return `${unit === "quarter" ? "T" : "S"}${number} ${yy}`;
}

export function periodLabel(period: PeriodFilter): string {
  if (isCalendarUnit(period.preset) && period.anchor) return unitLabel(period.preset, period.anchor);
  const range = period.preset === "custom" ? periodRange(period) : null;
  return range ? shortRangeLabel(range.from, range.to) : RANGE_LABELS[period.preset];
}
