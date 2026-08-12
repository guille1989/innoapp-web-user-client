import { fmtCurrency } from "../data/format";
import { FIELD_LABELS, GROUP_LABELS } from "../data/widgetLabels";
import { topGroup } from "./aggregate";
import type { Aggregation, AggregatableField, BusinessEvent, GroupField, Widget, WidgetType } from "../types";

export type WidgetIntent = Omit<Widget, "id">;

export function parseWidgetIntent(q: string): WidgetIntent | null {
  const wantsChart = /gr[aá]fica|barras|comparar|l[ií]nea|dona|proporci[oó]n|distribuci[oó]n/.test(q);
  const wantsKpi = /kpi|total(es)?\b/.test(q);
  if (!wantsChart && !wantsKpi) return null;

  let field: AggregatableField = "event_count";
  if (/venta|monto|ingreso|total/.test(q)) field = "total";
  else if (/item|ítem|art[ií]culo|cantidad/.test(q)) field = "quantity";
  else if (/descuento/.test(q)) field = "discount";
  else if (/propina/.test(q)) field = "tip";

  let group: GroupField | null = null;
  if (/robot|puerto|perif[eé]rico/.test(q)) group = "port";
  else if (/estado/.test(q)) group = "status";
  else if (/parser|parseo/.test(q)) group = "parsedBy";
  else if (/producto|descripci[oó]n/.test(q)) group = "description";

  let type: WidgetType = "kpi";
  if (/dona|proporci[oó]n|distribuci[oó]n/.test(q)) type = "donut";
  else if (/l[ií]nea/.test(q)) type = "line";
  else if (wantsChart) type = "bar";
  if (type === "line") group = "day";
  else if (type !== "kpi" && !group) group = "port";

  const agg: Aggregation = "sum";
  const title =
    (type === "kpi" ? "KPI: " : type === "bar" ? "Barras: " : type === "line" ? "Línea: " : "Dona: ") +
    FIELD_LABELS[field] +
    (group ? ` por ${GROUP_LABELS[group].toLowerCase()}` : "");

  return { type, field, agg, group, title };
}

export type AiResponse = { kind: "widget"; cfg: WidgetIntent } | { kind: "text"; text: React.ReactNode };

/**
 * Intentos locales, gratis e instantáneos (sin red) — solo los patrones que
 * ya reconocíamos antes del asistente conectado a Bedrock. Devuelve `null`
 * cuando no reconoce la pregunta, para que el que llama la mande al backend
 * en vez de responder con un catch-all genérico (eso ahora lo resuelve el
 * modelo, que sí puede consultar los datos reales — ver PROYECTO.md sección 13).
 */
export function respondLocally(question: string, events: BusinessEvent[]): AiResponse | null {
  const q = question.toLowerCase();

  const widgetCfg = parseWidgetIntent(q);
  if (widgetCfg) {
    return { kind: "widget", cfg: widgetCfg };
  }

  if ((q.includes("robot") || q.includes("puerto")) && (q.includes("más") || q.includes("mas") || q.includes("vendió") || q.includes("vendio"))) {
    const t = topGroup(events, "total", "sum", "port");
    if (!t) return { kind: "text" as const, text: "Aún no tengo suficientes lecturas." };
    return {
      kind: "text" as const,
      text: (
        <>
          El periférico con más ventas es <span className="mono-inline">{t.key}</span>, con {fmtCurrency(t.value)}{" "}
          acumulados.
        </>
      ),
    };
  }

  return null;
}
