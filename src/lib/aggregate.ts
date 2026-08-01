import { fmtCurrency } from "../data/mockEvents";
import type {
  Aggregation,
  AggregatableField,
  AggregateRow,
  BusinessEvent,
  GroupField,
} from "../types";

export function formatWidgetValue(field: AggregatableField, value: number): string {
  if (field === "monto" || field === "monto_inicial") return fmtCurrency(value);
  return Math.round(value).toLocaleString("es-ES");
}

const GROUP_KEY: Record<GroupField, (e: BusinessEvent) => string> = {
  store: (e) => e.store,
  robot: (e) => e.robot,
  event_type: (e) => e.meta.label,
  metodo_pago: (e) => (e.eventType === "venta" ? e.metodoPago : "Sin dato"),
};

function fieldValue(e: BusinessEvent, field: AggregatableField): number | undefined {
  if (field === "count") return 1;
  if (field === "monto") return "monto" in e ? e.monto : undefined;
  if (field === "items") return e.eventType === "venta" ? e.items : undefined;
  if (field === "monto_inicial") return e.eventType === "apertura_caja" ? e.montoInicial : undefined;
  return undefined;
}

function reduce(vals: number[], agg: Aggregation): number {
  if (!vals.length) return 0;
  if (agg === "sum") return vals.reduce((a, b) => a + b, 0);
  if (agg === "avg") return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (agg === "max") return Math.max(...vals);
  return Math.min(...vals);
}

export function aggregateValue(
  events: BusinessEvent[],
  field: AggregatableField,
  agg: Aggregation
): number {
  const vals = events
    .map((e) => fieldValue(e, field))
    .filter((v): v is number => v !== undefined);
  if (field === "count") return vals.length;
  return reduce(vals, agg);
}

export function aggregateByGroup(
  events: BusinessEvent[],
  field: AggregatableField,
  agg: Aggregation,
  group: GroupField
): AggregateRow[] {
  const buckets = new Map<string, number[]>();
  const keyOf = GROUP_KEY[group];
  for (const e of events) {
    const v = fieldValue(e, field);
    if (v === undefined) continue;
    const key = keyOf(e);
    const arr = buckets.get(key) ?? [];
    arr.push(v);
    buckets.set(key, arr);
  }
  const rows: AggregateRow[] = Array.from(buckets.entries()).map(([key, vals]) => ({
    key,
    value: field === "count" ? vals.length : reduce(vals, agg),
  }));
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, 6);
}

export function topGroup(
  events: BusinessEvent[],
  field: AggregatableField,
  agg: Aggregation,
  group: GroupField
): AggregateRow | null {
  const rows = aggregateByGroup(events, field, agg, group);
  return rows.length ? rows[0] : null;
}
