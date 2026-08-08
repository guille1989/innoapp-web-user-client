import { fmtCurrency } from "../data/format";
import { FIELD_LABELS, GROUP_LABELS } from "../data/widgetLabels";
import { topGroup } from "./aggregate";
import type { Aggregation, AggregatableField, BusinessEvent, GroupField, Widget, WidgetType } from "../types";

export type WidgetIntent = Omit<Widget, "id">;

export function parseWidgetIntent(q: string): WidgetIntent | null {
  const wantsChart = /gr[aá]fica|barras|comparar|dona|proporci[oó]n|distribuci[oó]n/.test(q);
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
  else if (wantsChart) type = "bar";
  if (type !== "kpi" && !group) group = "port";

  const agg: Aggregation = "sum";
  const title =
    (type === "kpi" ? "KPI: " : type === "bar" ? "Barras: " : "Dona: ") +
    FIELD_LABELS[field] +
    (group ? ` por ${GROUP_LABELS[group].toLowerCase()}` : "");

  return { type, field, agg, group, title };
}

export type AiResponse = { kind: "widget"; cfg: WidgetIntent } | { kind: "text"; text: React.ReactNode };

export function respond(question: string, events: BusinessEvent[]): AiResponse {
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

  return {
    kind: "text" as const,
    text: 'Puedo crear widgets con los campos que expone la API. Prueba: "gráfica del total por robot".',
  };
}
