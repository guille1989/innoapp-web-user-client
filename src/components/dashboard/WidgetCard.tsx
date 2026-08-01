import { aggregateByGroup, aggregateValue, formatWidgetValue } from "../../lib/aggregate";
import { AGG_LABELS, CHART_PALETTE } from "../../data/widgetLabels";
import { IconTrash } from "../icons";
import type { BusinessEvent, Widget } from "../../types";

interface WidgetCardProps {
  widget: Widget;
  events: BusinessEvent[];
  onRemove: (id: string) => void;
}

const TYPE_TAG: Record<Widget["type"], string> = { kpi: "KPI", bar: "Barras", donut: "Dona" };

export function WidgetCard({ widget: w, events, onRemove }: WidgetCardProps) {
  return (
    <div className="widget">
      <button className="widget-remove" onClick={() => onRemove(w.id)} aria-label={`Quitar widget ${w.title}`}>
        <IconTrash />
      </button>
      <div className="widget-label">
        <span className={`widget-type-tag ${w.type}`}>{TYPE_TAG[w.type]}</span>
        {w.title}
      </div>
      {w.type === "kpi" && <KpiBody widget={w} events={events} />}
      {w.type === "bar" && <BarBody widget={w} events={events} />}
      {w.type === "donut" && <DonutBody widget={w} events={events} />}
    </div>
  );
}

function KpiBody({ widget: w, events }: { widget: Widget; events: BusinessEvent[] }) {
  const value = aggregateValue(events, w.field, w.agg);
  return (
    <>
      <div className="kpi-value mono">{formatWidgetValue(w.field, value)}</div>
      <div className="kpi-sub">{w.field === "count" ? "conteo" : AGG_LABELS[w.agg].toLowerCase()} · en vivo</div>
    </>
  );
}

function BarBody({ widget: w, events }: { widget: Widget; events: BusinessEvent[] }) {
  const rows = w.group ? aggregateByGroup(events, w.field, w.agg, w.group) : [];
  const max = rows.length ? rows[0].value : 1;
  return (
    <div className="bar-rows">
      {rows.map((r) => (
        <div className="bar-row" key={r.key}>
          <div className="bar-row-label">{r.key}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
          </div>
          <div className="bar-row-val">{formatWidgetValue(w.field, r.value)}</div>
        </div>
      ))}
    </div>
  );
}

function DonutBody({ widget: w, events }: { widget: Widget; events: BusinessEvent[] }) {
  const rows = w.group ? aggregateByGroup(events, w.field, w.agg, w.group) : [];
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  let acc = 0;
  const stops = rows
    .map((r, i) => {
      const start = (acc / total) * 360;
      acc += r.value;
      const end = (acc / total) * 360;
      return `${CHART_PALETTE[i % CHART_PALETTE.length]} ${start}deg ${end}deg`;
    })
    .join(", ");
  return (
    <div className="donut-wrap">
      <div
        className="donut-ring"
        style={{ background: `conic-gradient(${stops || "var(--border) 0deg 360deg"})` }}
      >
        <div className="donut-total mono">{formatWidgetValue(w.field, total)}</div>
      </div>
      <div className="donut-legend">
        {rows.map((r, i) => (
          <div className="legend-row" key={r.key}>
            <span className="legend-dot" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
            <span className="legend-label">{r.key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
