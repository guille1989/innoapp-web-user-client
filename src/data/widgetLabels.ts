import type { Aggregation, AggregatableField, GroupField } from "../types";

export const FIELD_LABELS: Record<AggregatableField, string> = {
  count: "Nº de eventos",
  monto: "Monto",
  items: "Ítems",
  monto_inicial: "Monto inicial",
};

export const AGG_LABELS: Record<Aggregation, string> = {
  sum: "Suma",
  avg: "Promedio",
  max: "Máximo",
  min: "Mínimo",
};

export const GROUP_LABELS: Record<GroupField, string> = {
  store: "Sucursal",
  robot: "Robot",
  event_type: "Tipo de evento",
  metodo_pago: "Método de pago",
};

export const CHART_PALETTE = ["#4FD8C4", "#A79BFF", "#FFB454", "#FF6B6B", "#6FA8FF", "#8892A3"];
