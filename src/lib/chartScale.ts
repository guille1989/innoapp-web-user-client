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
export type RangePreset = "today" | "7d" | "30d" | "90d" | "all" | "custom";

export const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `GET /widgets/{id}/data` solo barre desde el 1 de enero del año pasado
 * (`DEFAULT_YEAR_LOOKBACK` en queryBuilder.ts del backend) — antes de esa
 * fecha no hay datos que filtrar en el navegador.
 */
export function dataFloorKey(): string {
  return `${new Date().getUTCFullYear() - 1}-01-01`;
}

/**
 * Fecha LOCAL del navegador (`en-CA` da YYYY-MM-DD), `offsetDays` hacia atrás o adelante.
 * El backend agrupa por día/hora en la zona del navegador (`?tz=`), así que "hoy"
 * tiene que ser el de esa misma zona — con UTC, después de las 19:00 en Colombia
 * "hoy" ya sería mañana.
 */
export function localDateKey(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function todayKey(): string {
  return localDateKey();
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

export const RANGE_LABELS: Record<RangePreset, string> = { today: "Hoy", "7d": "7 días", "30d": "30 días", "90d": "90 días", all: "Todo", custom: "Personalizado" };

const PRESET_DAYS:Record<Exclude<RangePreset, "all" | "custom">, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

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
export function isAdditive(widget: Pick<Widget, "field" | "agg"> & Partial<Pick<Widget, "group">>): boolean {
  // Un ticket con dos productos pertenece a ambas categorías: no sumar sus conteos.
  if (widget.field === "event_count" && widget.group === "description") return false;
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
  const buckets = new Map<string, AggregateRow[]>();
  for (const row of rows) {
    if (!DAY_KEY.test(row.key) || row.key < range.from || row.key > range.to) continue;
    const key = periodKey(row.key, granularity);
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
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

function reduceValues(rows: AggregateRow[], agg: Aggregation): number | null {
  if (agg === "max") return Math.max(...rows.map((row) => row.value));
  if (agg === "min") return Math.min(...rows.map((row) => row.value));
  if (agg !== "avg") return rows.reduce((total, row) => total + row.value, 0);
  if (rows.length === 1) return rows[0].value;
  // Versiones anteriores de la API no enviaban pesos: no inventar una media.
  if (rows.some((row) => !Number.isFinite(row.sampleCount) || row.sampleCount! <= 0)) return null;
  const count = rows.reduce((total, row) => total + row.sampleCount!, 0);
  return rows.reduce((total, row) => total + row.value * row.sampleCount!, 0) / count;
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
