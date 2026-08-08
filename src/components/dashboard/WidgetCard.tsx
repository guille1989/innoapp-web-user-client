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

const TYPE_TAG: Record<Widget["type"], string> = { kpi: "KPI", bar: "Barras", donut: "Dona" };

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

function DonutBody({ widget: w, events }: { widget: Widget; events: BusinessEvent[] }) {
  const rows = w.data ?? (w.group ? aggregateByGroup(events, w.field, w.agg, w.group) : []);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let acc = 0;
  const stops = rows.map((row, index) => { const start = total ? acc / total * 360 : 0; acc += row.value; const end = total ? acc / total * 360 : 360; return `${CHART_PALETTE[index % CHART_PALETTE.length]} ${start}deg ${end}deg`; }).join(", ");
  return <div className="donut-wrap"><div className="donut-ring" style={{ background: `conic-gradient(${stops || "var(--border) 0deg 360deg"})` }}><div className="donut-total mono">{formatWidgetValue(w.field, total)}</div></div><div className="donut-legend">{rows.slice(0, 6).map((row, index) => <div className="legend-row" key={row.key}><i style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }} /><span>{row.key}</span><b>{total ? Math.round(row.value / total * 100) : 0}%</b></div>)}</div></div>;
}
