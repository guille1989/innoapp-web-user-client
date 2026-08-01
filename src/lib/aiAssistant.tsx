import { fmtCurrency } from "../data/mockEvents";
import { FIELD_LABELS, GROUP_LABELS } from "../data/widgetLabels";
import { topGroup } from "./aggregate";
import type { Aggregation, AggregatableField, BusinessEvent, GroupField, Widget, WidgetType } from "../types";

export type WidgetIntent = Omit<Widget, "id">;

export function parseWidgetIntent(q: string): WidgetIntent | null {
  const wantsChart = /gr[aá]fica|barras|comparar|dona|proporci[oó]n|distribuci[oó]n/.test(q);
  const wantsKpi = /kpi|total(es)?\b/.test(q);
  if (!wantsChart && !wantsKpi) return null;

  let field: AggregatableField = "count";
  if (/monto inicial|apertura/.test(q)) field = "monto_inicial";
  else if (/venta|monto|ingreso/.test(q)) field = "monto";
  else if (/item|ítem|art[ií]culo/.test(q)) field = "items";

  let group: GroupField | null = null;
  if (/sucursal/.test(q)) group = "store";
  else if (/robot/.test(q)) group = "robot";
  else if (/tipo de evento|evento/.test(q)) group = "event_type";
  else if (/m[eé]todo de pago|pago/.test(q)) group = "metodo_pago";

  let type: WidgetType = "kpi";
  if (/dona|proporci[oó]n|distribuci[oó]n/.test(q)) type = "donut";
  else if (wantsChart) type = "bar";
  if (type !== "kpi" && !group) group = "store";

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

  if (q.includes("sucursal") && (q.includes("más") || q.includes("mas") || q.includes("vendió") || q.includes("vendio"))) {
    const t = topGroup(events, "monto", "sum", "store");
    if (!t) return { kind: "text" as const, text: "Aún no tengo suficientes lecturas." };
    return {
      kind: "text" as const,
      text: (
        <>
          Hoy la sucursal con más ventas es <span className="mono-inline">{t.key}</span>, con {fmtCurrency(t.value)}{" "}
          acumulados.
        </>
      ),
    };
  }

  if (q.includes("robot") && (q.includes("problema") || q.includes("falla") || q.includes("offline"))) {
    return {
      kind: "text" as const,
      text: (
        <>
          Detecto 1 robot sin señal: <span className="mono-inline">Robot-06</span> en Sucursal Este, sin lecturas
          hace 14 min.
        </>
      ),
    };
  }

  return {
    kind: "text" as const,
    text: 'Puedo interpretar cualquier campo que llegue de tus robots y crear un KPI o gráfica por ti. Prueba: "gráfica de ventas por sucursal".',
  };
}
