import type { Aggregation, AggregatableField, GroupField } from "../types";

export const FIELD_LABELS: Record<AggregatableField, string> = {
  event_count: "Nº de tickets",
  quantity: "Cantidad",
  unitPrice: "Precio unitario",
  subtotal: "Subtotal",
  discount: "Descuento",
  tip: "Propina",
  total: "Total",
};

export const AGG_LABELS: Record<Aggregation, string> = {
  sum: "Suma",
  avg: "Promedio",
  max: "Máximo",
  min: "Mínimo",
  count: "Conteo",
};

export const GROUP_LABELS: Record<GroupField, string> = {
  port: "Puerto / periférico",
  status: "Estado de parseo",
  parsedBy: "Método de parseo",
  description: "Producto",
  day: "Día",
};

export const CHART_PALETTE = ["#4FD8C4", "#A79BFF", "#FFB454", "#FF6B6B", "#6FA8FF", "#8892A3"];
