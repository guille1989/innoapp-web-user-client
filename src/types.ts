export type EventType = "venta" | "devolucion" | "apertura_caja";

export interface EventMeta {
  label: string;
  color: string;
  bg: string;
}

interface BusinessEventBase {
  id: number;
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
  metodoPago: "Efectivo" | "Tarjeta";
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

export type AggregatableField = "count" | "monto" | "items" | "monto_inicial";
export type Aggregation = "sum" | "avg" | "max" | "min";
export type GroupField = "store" | "robot" | "event_type" | "metodo_pago";

export type WidgetType = "kpi" | "bar" | "donut";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  field: AggregatableField;
  agg: Aggregation;
  group: GroupField | null;
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
