import { fmtAmount } from "../data/format";
import { AGG_LABELS, FIELD_LABELS } from "../data/widgetLabels";
import type { AggregateRow, Aggregation, Widget } from "../types";

/**
 * Escalas, ticks y fechas compartidos por las gráficas de los widgets. Las
 * claves de día ("2026-10-13") son días UTC: así las arma el backend con
 * `substr(capturedat, 1, 10)`, y todo lo de acá trabaja en UTC para no
 * correr un día según la zona del navegador.
 */

export type TimeGranularity = "day" | "week" | "month";
export type RangePreset = "7d" | "30d" | "90d" | "all" | "custom";

export const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `GET /widgets/{id}/data` solo barre desde el 1 de enero del año pasado
 * (`DEFAULT_YEAR_LOOKBACK` en queryBuilder.ts del backend) — antes de esa
 * fecha no hay datos que filtrar en el navegador.
 */
export function dataFloorKey(): string {
  return `${new Date().getUTCFullYear() - 1}-01-01`;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

export function addDays(key: string, days: number): string {
  const date = toDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function periodKey(dateKey: string, granularity: TimeGranularity): string {
  const date = toDate(dateKey);
  if (granularity === "week") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (granularity === "month") date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

function nextPeriodKey(key: string, granularity: TimeGranularity): string {
  const date = toDate(key);
  if (granularity === "day") date.setUTCDate(date.getUTCDate() + 1);
  if (granularity === "week") date.setUTCDate(date.getUTCDate() + 7);
  if (granularity === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

/** Último día que cubre el periodo que empieza en `key`. */
export function periodEndKey(key: string, granularity: TimeGranularity): string {
  return addDays(nextPeriodKey(key, granularity), -1);
}

export const RANGE_LABELS: Record<RangePreset, string> = { "7d": "7 días", "30d": "30 días", "90d": "90 días", all: "Todo", custom: "Personalizado" };

const PRESET_DAYS:Record<Exclude<RangePreset, "all" | "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function resolveRange(
  preset: RangePreset,
  custom: { from?: string; to?: string },
  firstKey: string | undefined,
  lastKey: string | undefined,
): { from: string; to: string } {
  const today = todayKey();
  if (preset === "custom" && custom.from && custom.to) {
    return custom.from <= custom.to ? { from: custom.from, to: custom.to } : { from: custom.to, to: custom.from };
  }
  if (preset === "all") {
    const to = lastKey && lastKey > today ? lastKey : today;
    return { from: firstKey ?? addDays(to, -29), to };
  }
  const days = preset === "custom" ? 30 : PRESET_DAYS[preset];
  return { from: addDays(today, -(days - 1)), to: today };
}

/** Sumas y conteos rellenan los periodos vacíos con 0; promedio/máximo/mínimo los dejan como hueco. */
export function isAdditive(widget: Pick<Widget, "field" | "agg">): boolean {
  return widget.field === "event_count" || widget.agg === "sum" || widget.agg === "count";
}

/** "42 tickets" / "suma de total" — lo que acompaña al número en tooltips y lectores de pantalla. */
export function metricLabel(widget: Pick<Widget, "field" | "agg">, value: number): string {
  if (widget.field === "event_count") return Math.round(value) === 1 ? "ticket" : "tickets";
  return `${AGG_LABELS[widget.agg].toLowerCase()} de ${FIELD_LABELS[widget.field].toLowerCase()}`;
}

/** El backend ignora la agregación en "event_count" (siempre cuenta tickets), así que acá también. */
function effectiveAgg(widget: Pick<Widget, "field" | "agg">): Aggregation {
  return widget.field === "event_count" ? "sum" : widget.agg;
}

export interface TimePoint {
  key: string;
  value: number | null;
}

export function buildTimeSeries(
  rows: AggregateRow[],
  widget: Pick<Widget, "field" | "agg">,
  range: { from: string; to: string },
  granularity: TimeGranularity,
): TimePoint[] {
  const agg = effectiveAgg(widget);
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    if (!DAY_KEY.test(row.key) || row.key < range.from || row.key > range.to) continue;
    const key = periodKey(row.key, granularity);
    buckets.set(key, [...(buckets.get(key) ?? []), row.value]);
  }
  const empty = isAdditive(widget) ? 0 : null;
  const points: TimePoint[] = [];
  const last = periodKey(range.to, granularity);
  for (let key = periodKey(range.from, granularity); key <= last; key = nextPeriodKey(key, granularity)) {
    const values = buckets.get(key);
    points.push({ key, value: values ? reduceValues(values, agg) : empty });
  }
  return points;
}

function reduceValues(values: number[], agg: Aggregation): number {
  if (agg === "max") return Math.max(...values);
  if (agg === "min") return Math.min(...values);
  const sum = values.reduce((total, value) => total + value, 0);
  return agg === "avg" ? sum / values.length : sum;
}

/**
 * Marcas "redondas" para el eje Y (0, 10, 20…). `integer` evita marcas
 * fraccionarias en conteos — "2,5 tickets" no existe.
 */
export function niceTicks(minValue: number, maxValue: number, target: number, integer: boolean): number[] {
  const low = Math.min(0, minValue);
  const high = maxValue > low ? maxValue : low + 1;
  const rough = (high - low) / Math.max(1, target);
  const power = 10 ** Math.floor(Math.log10(rough));
  const multipliers = integer && power < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = multipliers.map((m) => m * power).find((candidate) => candidate >= rough) ?? 10 * power;
  if (integer) step = Math.max(1, Math.round(step));
  const ticks: number[] = [];
  for (let tick = Math.floor(low / step) * step; tick < high + step / 2; tick += step) ticks.push(Number(tick.toFixed(10)));
  if (ticks[ticks.length - 1] < high) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

const NICE_TICK_STEPS: Record<TimeGranularity, number[]> = {
  day: [1, 2, 3, 7, 14, 28, 56, 91, 182],
  week: [1, 2, 4, 8, 13, 26, 52],
  month: [1, 2, 3, 6, 12, 24],
};

/**
 * Qué puntos del eje X llevan fecha. Se cuenta hacia atrás desde el último
 * punto para que el periodo más reciente siempre tenga su etiqueta, con un
 * paso "de calendario" (cada día, cada semana, cada 2 semanas…) que entra
 * en el ancho disponible.
 */
export function pickTickIndices(count: number, maxTicks: number, granularity: TimeGranularity): number[] {
  if (count === 0) return [];
  const limit = Math.max(1, maxTicks);
  const step = NICE_TICK_STEPS[granularity].find((candidate) => Math.ceil(count / candidate) <= limit) ?? Math.ceil(count / limit);
  const indices: number[] = [];
  for (let index = count - 1; index >= 0; index -= step) indices.push(index);
  return indices.reverse();
}

const DAY_TICK = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const MONTH_TICK = new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" });
const DAY_FULL = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const MONTH_FULL = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

export function tickLabel(key: string, granularity: TimeGranularity): string {
  return (granularity === "month" ? MONTH_TICK : DAY_TICK).format(toDate(key));
}

export function fullPeriodLabel(key: string, granularity: TimeGranularity): string {
  if (granularity === "day") return DAY_FULL.format(toDate(key));
  if (granularity === "month") return MONTH_FULL.format(toDate(key));
  return `Semana del ${DAY_TICK.format(toDate(key))} al ${DAY_TICK.format(toDate(addDays(key, 6)))}`;
}

export function shortRangeLabel(from: string, to: string): string {
  return `${DAY_TICK.format(toDate(from))} – ${DAY_TICK.format(toDate(to))}`;
}

const AXIS_SMALL = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const AXIS_COMPACT = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });

/** Marcas de eje y etiquetas sobre la gráfica: "1.250" se lee entero, "1,3 M" se compacta. */
export function fmtAxis(value: number): string {
  return Math.abs(value) < 10_000 ? AXIS_SMALL.format(value) : AXIS_COMPACT.format(value);
}

/** Valor completo para tooltips — mismo formato que el resto del dashboard. */
export function fmtFull(value: number): string {
  return fmtAmount(value);
}
