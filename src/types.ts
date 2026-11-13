export type EventType = "venta" | "devolucion" | "apertura_caja";

export interface EventMeta {
  label: string;
  color: string;
  bg: string;
}

interface BusinessEventBase {
  id: string;
  ts: number;
  timeStr: string;
  store: string;
  robot: string;
  eventType: EventType;
  meta: EventMeta;
}

export interface VentaEvent extends BusinessEventBase {
  eventType: "venta";
  monto: number;
  items: number;
  /** Fecha límite de pago (YYYY-MM-DD); solo las facturas electrónicas la traen. */
  vence?: string;
  /** Medio de pago normalizado (Efectivo, QR…); solo los tickets que lo traen. */
  medioPago?: string;
}

export interface DevolucionEvent extends BusinessEventBase {
  eventType: "devolucion";
  monto: number;
  motivo: string;
}

export interface AperturaCajaEvent extends BusinessEventBase {
  eventType: "apertura_caja";
  montoInicial: number;
}

export type BusinessEvent = VentaEvent | DevolucionEvent | AperturaCajaEvent;

export type AggregatableField = "event_count" | "quantity" | "unitPrice" | "subtotal" | "discount" | "tip" | "tax" | "total";
/** "daily_avg": suma del período ÷ días del período (lo divide el backend); solo en KPIs. */
export type Aggregation = "sum" | "avg" | "max" | "min" | "count" | "daily_avg";
export type GroupField = "port" | "agent" | "status" | "parsedBy" | "description" | "customer" | "paymentMethod" | "hourOfDay" | "weekday" | "day" | "hour";

export type WidgetType = "kpi" | "bar" | "line" | "donut" | "table";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  field: AggregatableField;
  agg: Aggregation;
  group: GroupField | null;
  /** Solo KPI: segunda cifra (p. ej. unidades) que se muestra junto a la principal. */
  secondaryField?: AggregatableField;
  secondaryAgg?: Aggregation;
  secondaryData?: AggregateRow[];
  /** Limita el widget a una sucursal (agente). Sin valor, incluye todas. */
  agentId?: string;
  /** Limita el widget a los productos cuyo nombre contiene este texto. */
  descriptionContains?: string;
  /** Limita el widget a ventas pagadas con este medio (Efectivo, QR, Datafono…). */
  paymentMethod?: string;
  data?: AggregateRow[];
  dataStatus?: "loading" | "ready" | "error" | "stale";
  dataError?: string;
  updatedAt?: string;
  dataLabel?: string;
  /** Clave del dato → texto a mostrar (ej. agentId → nombre del agente). Sin entrada se muestra la clave. */
  keyLabels?: Record<string, string>;
}

export interface AggregateRow {
  key: string;
  value: number;
  /** Número de observaciones del promedio, después de deduplicar tickets. */
  sampleCount?: number;
}

export type RobotStatus = "online" | "warn" | "offline";

export interface Robot {
  id: string;
  name: string;
  store: string;
  city: string;
  lat?: number;
  lng?: number;
  status: RobotStatus;
  meta: string;
  /** Versión reportada por el agent en el último heartbeat (observacional). */
  version?: string;
}
