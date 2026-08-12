import { fmtCurrency } from "../data/format";
import type {
  Aggregation,
  AggregatableField,
  AggregateRow,
  BusinessEvent,
  GroupField,
} from "../types";

export function formatWidgetValue(field: AggregatableField, value: number): string {
  if (["unitPrice", "subtotal", "discount", "tip", "total"].includes(field)) return fmtCurrency(value);
  return Math.round(value).toLocaleString("es-ES");
}

const GROUP_KEY: Record<GroupField, (e: BusinessEvent) => string> = {
  port: (e) => e.robot,
  status: (e) => e.meta.label,
  parsedBy: () => "Sin dato",
  description: () => "Sin dato",
  day: (e) => new Date(e.ts).toISOString().slice(0, 10),
};

function fieldValue(e: BusinessEvent, field: AggregatableField): number | undefined {
  if (field === "event_count") return 1;
  if (field === "total") return "monto" in e ? e.monto : undefined;
  if (field === "quantity") return e.eventType === "venta" ? e.items : undefined;
  return undefined;
}

function reduce(vals: number[], agg: Aggregation): number {
  if (!vals.length) return 0;
  if (agg === "sum") return vals.reduce((a, b) => a + b, 0);
  if (agg === "avg") return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (agg === "max") return Math.max(...vals);
  if (agg === "count") return vals.length;
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
  if (field === "event_count") return vals.length;
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
    value: field === "event_count" ? vals.length : reduce(vals, agg),
  }));
  rows.sort(group === "day" ? (a, b) => a.key.localeCompare(b.key) : (a, b) => b.value - a.value);
  return group === "day" ? rows : rows.slice(0, 6);
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
