import { formatWidgetValue } from "../../lib/aggregate";
import { AGG_LABELS } from "../../data/widgetLabels";
import { IconTrash } from "../icons";
import { BarChart } from "./charts/BarChart";
import { DonutChart } from "./charts/DonutChart";
import { HourlyChart } from "./charts/HourlyChart";
import { LineChart } from "./charts/LineChart";
import type { BusinessEvent, Widget } from "../../types";

interface WidgetCardProps {
  widget: Widget;
  events: BusinessEvent[];
  onRemove: (id: string) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
}

const TYPE_TAG: Record<Widget["type"], string> = { kpi: "KPI", bar: "Barras", line: "Línea", donut: "Dona" };

export function WidgetCard({ widget: w, onRemove, onDragStart, onResizeStart }: WidgetCardProps) {
  return (
    <article className="widget glass">
      <header className="widget-head" onPointerDown={onDragStart}>
        <div className="drag-dots"><i /><i /><i /></div>
        <div className="widget-label"><span className={`widget-type-tag ${w.type}`}>{TYPE_TAG[w.type]}</span><span>{w.title}</span></div>
        <button className="widget-remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemove(w.id)} aria-label={`Quitar widget ${w.title}`}><IconTrash /></button>
      </header>
      {(w.dataStatus === "stale" || w.dataStatus === "error") && (
        <div className="widget-data-notice" role="status" title={w.dataError}>
          {w.dataStatus === "stale"
            ? "Datos sin actualizar" + (w.updatedAt ? " · " + new Date(w.updatedAt).toLocaleString("es-ES") : "")
            : "No se pudieron consultar los datos"}
        </div>
      )}
      <div className="widget-body">
        {w.dataStatus === "loading" && <span className="widget-empty">Consultando datos…</span>}
        {w.dataStatus !== "loading" && w.dataStatus !== "error" && w.type === "kpi" && <KpiBody widget={w} />}
        {w.dataStatus !== "loading" && w.dataStatus !== "error" && (
          <>
            {w.type === "bar" && <BarChart widget={w} />}
            {w.type === "line" && (w.group === "hour" ? <HourlyChart widget={w} /> : <LineChart widget={w} />)}
            {w.type === "donut" && <DonutChart widget={w} />}
          </>
        )}
      </div>
      <button className="resize-handle" onPointerDown={onResizeStart} aria-label={`Redimensionar ${w.title}`}><span>⌟</span></button>
    </article>
  );
}

function KpiBody({ widget: w }: { widget: Widget }) {
  const value = w.data?.[0]?.value;
  if (value === undefined) return <span className="widget-empty">Sin datos para esta métrica</span>;
  return <div className="kpi-body"><div className="kpi-value mono">{formatWidgetValue(w.field, value)}</div><div className="kpi-sub"><span className="trend-dot" />{w.field === "event_count" ? "conteo" : AGG_LABELS[w.agg].toLowerCase()} · {w.dataStatus === "stale" ? "último resultado válido" : w.dataLabel ?? "datos confirmados"}</div></div>;
}
