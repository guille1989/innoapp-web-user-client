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
  metodoPago: "Efectivo" | "Tarjeta" | "Sin dato";
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

export type AggregatableField = "event_count" | "quantity" | "unitPrice" | "subtotal" | "discount" | "tip" | "total";
export type Aggregation = "sum" | "avg" | "max" | "min" | "count";
export type GroupField = "port" | "status" | "parsedBy" | "description";

export type WidgetType = "kpi" | "bar" | "donut";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  field: AggregatableField;
  agg: Aggregation;
  group: GroupField | null;
  data?: AggregateRow[];
}

export interface AggregateRow {
  key: string;
  value: number;
}

export type RobotStatus = "online" | "warn" | "offline";

export interface Robot {
  name: string;
  store: string;
  city: string;
  lat: number;
  lng: number;
  status: RobotStatus;
  meta: string;
}
