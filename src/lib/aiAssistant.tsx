import { FIELD_LABELS, GROUP_LABELS } from "../data/widgetLabels";
import type { Aggregation, AggregatableField, GroupField, Widget, WidgetType } from "../types";

export type WidgetIntent = Omit<Widget, "id">;

// Solo se crea un widget cuando el mensaje nombra una visualización. Antes
// bastaba con "día", "total" o "comparar", y una pregunta como "¿qué día
// vendimos más?" terminaba creando una Línea en vez de ir al asistente a
// buscar la respuesta. Las palabras sueltas de abajo (temporales, "torta",
// "proporción"…) solo eligen el tipo una vez que ya se pidió un widget.
const VIZ_RE = /gr[aá]fic[ao]|widget|kpi|kipi|indicador|barras|l[ií]nea|dona|\bpie\b/;
const KPI_RE = /kpi|kipi|indicador/;

// "Ticket medio" / "promedio" es un promedio del total, no una suma ni un conteo.
const AVG_RE = /ticket\s+(medio|promedio)|promedio|\bmedia\b|\bmedio\b/;
const FIELD_RE = /venta|monto|ingreso|total|item|ítem|art[ií]culo|cantidad|descuento|propina|ticket/;
const GROUP_RE = /agente|robot|puerto|perif[eé]rico|estado|parser|parseo|producto|descripci[oó]n/;

// No hay tipo "pie": la dona es el único gráfico circular, así que "pie",
// "torta", "pastel", etc. van a dona. Sin esto "gráfica tipo pie" caía en
// Barras (el default de cualquier "gráfica").
const DONUT_RE = /dona|\bpie\b|torta|pastel|queso|circular|proporci[oó]n|distribuci[oó]n/;

export function parseWidgetIntent(q: string, previous?: string): WidgetIntent | null {
  if (!VIZ_RE.test(q)) return null;

  // "ponme en un widget" no dice de qué: el tema viene de la pregunta anterior
  // ("quiero ver el ticket medio"). Sin esto caía en Barras de tickets por agente.
  if (previous && !FIELD_RE.test(q) && !GROUP_RE.test(q) && !AVG_RE.test(q)) {
    q = `${previous.toLowerCase()} ${q}`;
  }
  const isAverage = AVG_RE.test(q);
  // Alguien pidiendo el eje x en tiempo ("días", "meses", "por fecha") quiere
  // una línea temporal aunque no diga la palabra "línea" — sin esto el tipo
  // caía en Barras y el grupo por defecto era "puerto", nada que ver con lo
  // pedido.
  // "Evolución"/"tendencia" también son eje de tiempo ("una gráfica de la
  // evolución de ventas" caía en Barras por agente), y "hora" pide el eje por hora.
  const wantsHourly = /\bhoras?\b|\bhorari[oa]s?\b/.test(q);
  const wantsTemporal = wantsHourly || /\bd[ií]as?\b|\bsemanas?\b|\bmes(es)?\b|\btiempo\b|por fecha|evoluci[oó]n|tendencia/.test(q);

  let field: AggregatableField = "event_count";
  if (/venta|monto|ingreso|total/.test(q) || (isAverage && /ticket/.test(q))) field = "total";
  else if (/item|ítem|art[ií]culo|cantidad/.test(q)) field = "quantity";
  else if (/descuento/.test(q)) field = "discount";
  else if (/propina/.test(q)) field = "tip";

  let group: GroupField | null = null;
  if (/agente/.test(q)) group = "agent";
  else if (/robot|puerto|perif[eé]rico/.test(q)) group = "port";
  else if (/estado/.test(q)) group = "status";
  else if (/parser|parseo/.test(q)) group = "parsedBy";
  else if (/producto|descripci[oó]n/.test(q)) group = "description";

  let type: WidgetType = "bar";
  if (KPI_RE.test(q)) type = "kpi";
  else if (DONUT_RE.test(q)) type = "donut";
  else if (/l[ií]nea/.test(q) || wantsTemporal) type = "line";
  if (type === "line") group = wantsHourly ? "hour" : "day";
  else if (type !== "kpi" && !group) group = "agent";

  const agg: Aggregation = isAverage ? "avg" : "sum";
  const title =
    (type === "kpi" ? "KPI: " : type === "bar" ? "Barras: " : type === "line" ? "Línea: " : "Dona: ") +
    (isAverage && field === "total" ? "Ticket medio" : FIELD_LABELS[field]) +
    (group ? ` por ${GROUP_LABELS[group].toLowerCase()}` : "");

  return { type, field, agg, group, title };
}

export type AiResponse = { kind: "widget"; cfg: WidgetIntent };

/**
 * Intentos locales, gratis e instantáneos (sin red) — solo los patrones que
 * ya reconocíamos antes del asistente conectado a Bedrock. Devuelve `null`
 * cuando no reconoce la pregunta, para que el que llama la mande al backend
 * en vez de responder con un catch-all genérico (eso ahora lo resuelve el
 * modelo, que sí puede consultar los datos reales — ver PROYECTO.md sección 13).
 */
export function respondLocally(question: string, previousQuestion?: string): AiResponse | null {
  const q = question.toLowerCase();

  const widgetCfg = parseWidgetIntent(q, previousQuestion);
  if (widgetCfg) {
    return { kind: "widget", cfg: widgetCfg };
  }

  return null;
}
