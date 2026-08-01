import type { BusinessEvent, EventMeta, EventType, Robot } from "../types";

const STORES = ["Sucursal Centro", "Sucursal Norte", "Sucursal Sur", "Sucursal Este"];

const ROBOTS_BY_STORE: Record<string, string[]> = {
  "Sucursal Centro": ["Robot-01", "Robot-03"],
  "Sucursal Norte": ["Robot-02"],
  "Sucursal Sur": ["Robot-04"],
  "Sucursal Este": ["Robot-06"],
};

const EVENT_TYPES: Array<{ key: EventType; weight: number; meta: EventMeta }> = [
  { key: "venta", weight: 78, meta: { label: "venta", color: "var(--teal)", bg: "var(--teal-dim)" } },
  { key: "devolucion", weight: 12, meta: { label: "devolución", color: "var(--amber)", bg: "var(--amber-dim)" } },
  { key: "apertura_caja", weight: 10, meta: { label: "apertura caja", color: "var(--violet)", bg: "var(--violet-dim)" } },
];

export const ROBOTS: Robot[] = [
  { name: "Robot-01", store: "Sucursal Centro", city: "Madrid", lat: 40.4168, lng: -3.7038, status: "online", meta: "hace 3s" },
  { name: "Robot-02", store: "Sucursal Norte", city: "Bilbao", lat: 43.263, lng: -2.935, status: "online", meta: "hace 7s" },
  { name: "Robot-03", store: "Sucursal Centro", city: "Madrid", lat: 40.426, lng: -3.689, status: "warn", meta: "cola local: 4" },
  { name: "Robot-04", store: "Sucursal Sur", city: "Sevilla", lat: 37.3891, lng: -5.9845, status: "online", meta: "hace 1s" },
  { name: "Robot-05", store: "Sucursal Este", city: "Valencia", lat: 39.4699, lng: -0.3763, status: "online", meta: "hace 5s" },
  { name: "Robot-06", store: "Sucursal Este", city: "Barcelona", lat: 41.3874, lng: 2.1686, status: "offline", meta: "hace 14 min" },
];

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function randInt(a: number, b: number) {
  return Math.floor(rand(a, b + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function nowStr() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pickWeighted() {
  const total = EVENT_TYPES.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of EVENT_TYPES) {
    if (r < e.weight) return e;
    r -= e.weight;
  }
  return EVENT_TYPES[0];
}

let seq = 1;

export function genEvent(): BusinessEvent {
  const store = pick(STORES);
  const robot = pick(ROBOTS_BY_STORE[store]);
  const et = pickWeighted();
  const base = {
    id: seq++,
    ts: Date.now(),
    timeStr: nowStr(),
    store,
    robot,
    meta: et.meta,
  };

  if (et.key === "venta") {
    return {
      ...base,
      eventType: "venta",
      monto: Math.round(rand(15, 180) * 100) / 100,
      items: randInt(1, 6),
      metodoPago: pick(["Efectivo", "Tarjeta"]),
    };
  }
  if (et.key === "devolucion") {
    return {
      ...base,
      eventType: "devolucion",
      monto: -Math.round(rand(10, 80) * 100) / 100,
      motivo: pick(["Producto defectuoso", "Cambio de talla", "Error de cobro"]),
    };
  }
  return {
    ...base,
    eventType: "apertura_caja",
    montoInicial: Math.round(rand(100, 300)),
  };
}

export function fmtCurrency(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-ES");
}
