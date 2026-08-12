import { Fragment, useState } from "react";
import { aggregateByGroup, aggregateValue, formatWidgetValue } from "../../lib/aggregate";
import { AGG_LABELS, CHART_PALETTE } from "../../data/widgetLabels";
import { IconTrash } from "../icons";
import type { BusinessEvent, Widget } from "../../types";

interface WidgetCardProps {
  widget: Widget;
  events: BusinessEvent[];
  onRemove: (id: string) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
}

const TYPE_TAG: Record<Widget["type"], string> = { kpi: "KPI", bar: "Barras", line: "Línea", donut: "Dona" };

export function WidgetCard({ widget: w, events, onRemove, onDragStart, onResizeStart }: WidgetCardProps) {
  return (
    <article className="widget glass">
      <header className="widget-head" onPointerDown={onDragStart}>
        <div className="drag-dots"><i /><i /><i /></div>
        <div className="widget-label"><span className={`widget-type-tag ${w.type}`}>{TYPE_TAG[w.type]}</span><span>{w.title}</span></div>
        <button className="widget-remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemove(w.id)} aria-label={`Quitar widget ${w.title}`}><IconTrash /></button>
      </header>
      <div className="widget-body">
        {w.type === "kpi" && <KpiBody widget={w} events={events} />}
        {w.type === "bar" && <BarBody widget={w} events={events} />}
        {w.type === "line" && <LineBody widget={w} events={events} />}
        {w.type === "donut" && <DonutBody widget={w} events={events} />}
      </div>
      <button className="resize-handle" onPointerDown={onResizeStart} aria-label={`Redimensionar ${w.title}`}><span>⌟</span></button>
    </article>
  );
}

function KpiBody({ widget: w, events }: { widget: Widget; events: BusinessEvent[] }) {
  const value = w.data?.[0]?.value ?? aggregateValue(events, w.field, w.agg);
  return <div className="kpi-body"><div className="kpi-value mono">{formatWidgetValue(w.field, value)}</div><div className="kpi-sub"><span className="trend-dot" />{w.field === "event_count" ? "conteo" : AGG_LABELS[w.agg].toLowerCase()} · datos reales</div></div>;
}

function BarBody({ widget: w, events }: { widget: Widget; events: BusinessEvent[] }) {
  const rows = w.data ?? (w.group ? aggregateByGroup(events, w.field, w.agg, w.group) : []);
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="bar-chart">{rows.length === 0 && <span className="widget-empty">Sin datos para esta agrupación</span>}{rows.slice(0, 7).map((row) => <div className="bar-column" key={row.key}><div className="bar-column-value">{formatWidgetValue(w.field, row.value)}</div><div className="bar-column-track"><div style={{ height: `${Math.max(7, row.value / max * 100)}%` }} /></div><span title={row.key}>{row.key}</span></div>)}</div>;
}

type TimeGranularity = "day" | "week" | "month";
const GRANULARITY_LABELS: Record<TimeGranularity, string> = { day: "Día", week: "Semana", month: "Mes" };

function periodKey(dateKey: string, granularity: TimeGranularity): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (granularity === "week") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (granularity === "month") date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

function periodLabel(dateKey: string, granularity: TimeGranularity): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const label = new Intl.DateTimeFormat("es-ES", granularity === "month"
    ? { month: "short", year: "2-digit", timeZone: "UTC" }
    : { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
  return granularity === "week" ? `Sem. ${label}` : label;
}

function groupTimeRows(rows: Array<{ key: string; value: number }>, granularity: TimeGranularity, agg: Widget["agg"]) {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.key)) continue;
    const key = periodKey(row.key, granularity);
    buckets.set(key, [...(buckets.get(key) ?? []), row.value]);
  }
  return Array.from(buckets, ([key, values]) => ({
    key,
    value: agg === "max" ? Math.max(...values) : agg === "min" ? Math.min(...values) : agg === "avg"
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : values.reduce((sum, value) => sum + value, 0),
  })).sort((a, b) => a.key.localeCompare(b.key));
}

function LineBody({ widget: w, events }: { widget: Widget; events: BusinessEvent[] }) {
  const [granularity, setGranularity] = useState<TimeGranularity>("day");
  const dailyRows = w.data ?? (w.group ? aggregateByGroup(events, w.field, w.agg, w.group) : []);
  const rows = groupTimeRows(dailyRows, granularity, w.agg);

  if (rows.length === 0) return <div className="line-chart"><TimeControls value={granularity} onChange={setGranularity} /><span className="widget-empty">Sin datos para este periodo</span></div>;

  const values = rows.map((row) => row.value);
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const xFor = (index: number) => rows.length === 1 ? 50 : 4 + index / (rows.length - 1) * 92;
  const yFor = (value: number) => 8 + (max - value) / range * 76;
  const baseline = yFor(0);
  const points = rows.map((row, index) => `${xFor(index)},${yFor(row.value)}`).join(" ");
  const areaPoints = `${xFor(0)},${baseline} ${points} ${xFor(rows.length - 1)},${baseline}`;
  const axisRows = rows.length < 3 ? rows : [rows[0], rows[Math.floor((rows.length - 1) / 2)], rows.at(-1)!];

  // Los puntos y sus labels se dibujan como HTML posicionado por %, no como
  // <circle>/<text> del SVG: el viewBox usa preserveAspectRatio="none" para
  // que la línea/área llenen el ancho real del widget, pero eso estira los
  // círculos de forma no uniforme y los deja ovalados. Un <div> con
  // border-radius no se ve afectado por ese escalado del SVG.
  return <div className="line-chart"><TimeControls value={granularity} onChange={setGranularity} /><div className="line-plot"><div className="line-y-labels"><span>{formatWidgetValue(w.field, max)}</span><span>{formatWidgetValue(w.field, min)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Gráfica temporal de ${w.title}`}><defs><linearGradient id={`line-fill-${w.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--teal)" stopOpacity=".26" /><stop offset="1" stopColor="var(--teal)" stopOpacity="0" /></linearGradient></defs><path className="line-area" d={`M ${areaPoints} Z`} fill={`url(#line-fill-${w.id})`} /><polyline className="line-stroke" points={points} /></svg><div className="line-points">{rows.map((row, index) => { const pos = { left: `${xFor(index)}%`, top: `${yFor(row.value)}%` }; return <Fragment key={row.key}><span className="line-point-label" style={pos}>{formatWidgetValue(w.field, row.value)}</span><span className="line-point-dot" style={pos} title={`${periodLabel(row.key, granularity)}: ${formatWidgetValue(w.field, row.value)}`} /></Fragment>; })}</div></div><div className="line-labels">{axisRows.map((row) => <span key={row.key}>{periodLabel(row.key, granularity)}</span>)}</div></div>;
}

function TimeControls({ value, onChange }: { value: TimeGranularity; onChange: (value: TimeGranularity) => void }) {
  return <div className="line-controls" aria-label="Agrupación temporal">{(Object.keys(GRANULARITY_LABELS) as TimeGranularity[]).map((item) => <button key={item} type="button" className={value === item ? "active" : ""} onClick={() => onChange(item)}>{GRANULARITY_LABELS[item]}</button>)}</div>;
}

function DonutBody({ widget: w, events }: { widget: Widget; events: BusinessEvent[] }) {
  const rows = w.data ?? (w.group ? aggregateByGroup(events, w.field, w.agg, w.group) : []);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let acc = 0;
  const stops = rows.map((row, index) => { const start = total ? acc / total * 360 : 0; acc += row.value; const end = total ? acc / total * 360 : 360; return `${CHART_PALETTE[index % CHART_PALETTE.length]} ${start}deg ${end}deg`; }).join(", ");
  return <div className="donut-wrap"><div className="donut-ring" style={{ background: `conic-gradient(${stops || "var(--border) 0deg 360deg"})` }}><div className="donut-total mono">{formatWidgetValue(w.field, total)}</div></div><div className="donut-legend">{rows.slice(0, 6).map((row, index) => <div className="legend-row" key={row.key}><i style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }} /><span>{row.key}</span><b>{total ? Math.round(row.value / total * 100) : 0}%</b></div>)}</div></div>;
}
