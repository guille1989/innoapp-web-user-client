import { useSyncExternalStore } from "react";
import { RANGE_LABELS, resolveRange, shortRangeLabel, type RangePreset } from "./chartScale";

/**
 * Período de tiempo que comparten todos los widgets de la vista de Datos. Es
 * temporal a propósito: vive solo en memoria, así que al recargar vuelve a
 * "30 días" (a diferencia del tamaño del texto, que sí se guarda). Lo lee
 * `useCloudData` para pedir los datos ya filtrados y los gráficos para rotularse.
 */
export interface PeriodFilter {
  preset: RangePreset;
  from?: string;
  to?: string;
}

export const DEFAULT_PERIOD: PeriodFilter = { preset: "30d" };

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
 * al llamar: "30 días" sigue a "hoy" si la pestaña cruza la medianoche.
 */
export function periodRange(period: PeriodFilter): { from: string; to: string } | null {
  if (period.preset === "all") return null;
  return resolveRange(period.preset, period, undefined, undefined);
}

export function periodLabel(period: PeriodFilter): string {
  const range = period.preset === "custom" ? periodRange(period) : null;
  return range ? shortRangeLabel(range.from, range.to) : RANGE_LABELS[period.preset];
}
