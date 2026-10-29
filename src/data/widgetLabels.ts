import type { Aggregation, AggregatableField, GroupField } from "../types";

export const FIELD_LABELS: Record<AggregatableField, string> = {
  event_count: "Nº de tickets",
  quantity: "Cantidad",
  unitPrice: "Precio unitario",
  subtotal: "Subtotal",
  discount: "Descuento",
  tip: "Propina",
  tax: "Impuestos",
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
  agent: "Agente",
  status: "Estado de parseo",
  parsedBy: "Método de parseo",
  description: "Producto",
  customer: "Cliente",
  day: "Día",
  hour: "Hora",
};

/**
 * Colores por categoría (dona). Validados contra el fondo de los widgets
 * en dark (#111318) y en light (#ffffff, --chart-surface) con el validador del
 * skill dataviz — los mismos hex pasan en ambos temas; en light el contraste
 * mínimo es 3.07:1 (#c98500), apenas sobre el piso de 3:1, así que no se deben
 * aclarar. Misma luminosidad, croma
 * suficiente y separables con daltonismo (protan/deutan) entre vecinos en
 * ESTE orden, incluido el cierre del anillo último→primero. Reordenarlos o
 * agregar uno rompe esa garantía — se revalida antes. No incluye rojo: ese
 * color queda para estados (error/caído). Lo que no entra va a "Otros", gris.
 */
export const CHART_PALETTE = ["#2aa198", "#9085e9", "#d95926", "#3987e5", "#c98500"];
export const CHART_OTHER_COLOR = "#5d6472";
