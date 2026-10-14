import { useState } from "react";
import { formatWidgetValue } from "../../../lib/aggregate";
import { fmtAxis, isAdditive, metricLabel } from "../../../lib/chartScale";
import { ChartTooltip } from "./ChartTooltip";
import { useElementSize } from "./useElementSize";
import type { Widget } from "../../../types";

const ROW_HEIGHT = 26;

/**
 * Barras horizontales: las categorías (productos, puertos, estados) son
 * texto y se leen enteras a la izquierda en vez de cortadas a 7px bajo una
 * columna. El backend ya las manda ordenadas de mayor a menor; se muestran
 * todas y la lista hace scroll cuando no entran en el alto del widget. El
 * tooltip queda fuera del área con scroll para acomodarse al alto visible
 * (debajo de la fila si entra, si no encima), no al de la lista entera.
 */
export function BarChart({ widget: w }: { widget: Widget }) {
  const rows = w.data ?? [];
  const [chartRef, size] = useElementSize<HTMLDivElement>();
  const [scrollTop, setScrollTop] = useState(0);
  const [hover, setHover] = useState<{ index: number; x: number } | null>(null);

  if (rows.length === 0) return <div className="bar-list"><span className="widget-empty">Sin datos para esta agrupación</span></div>;

  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0) || 1;
  const additive = isAdditive(w);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const active = hover && hover.index < rows.length ? hover.index : null;
  const activeRow = active !== null ? rows[active] : undefined;
  const activeTop = active !== null ? active * ROW_HEIGHT - scrollTop : 0;
  const pointerX = (e: React.PointerEvent<HTMLElement>, list: Element | null) => e.clientX - (list?.getBoundingClientRect().left ?? 0);

  return (
    <div
      className="bar-chart"
      ref={chartRef}
      onPointerMove={(e) => { if (hover) setHover({ ...hover, x: pointerX(e, e.currentTarget) }); }}
      onPointerLeave={() => setHover(null)}
    >
      <div className="bar-list" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        {rows.map((row, index) => {
          const ratio = Math.max(0, row.value) / max;
          return (
            <div
              key={row.key}
              className={`bar-row${active === index ? " active" : ""}${active !== null && active !== index ? " dimmed" : ""}`}
              tabIndex={0}
              aria-label={`${row.key}: ${formatWidgetValue(w.field, row.value)} ${metricLabel(w, row.value)}`}
              onPointerEnter={(e) => setHover({ index, x: pointerX(e, e.currentTarget.parentElement) })}
              onFocus={() => setHover((current) => (current?.index === index ? current : { index, x: size.width / 2 }))}
              onBlur={() => setHover(null)}
            >
              <span className="bar-row-label">{row.key}</span>
              <span className="bar-row-track">
                <i style={{ width: `calc((100% - 46px) * ${ratio.toFixed(4)})` }} />
                <b>{fmtAxis(row.value)}</b>
              </span>
            </div>
          );
        })}
      </div>
      {activeRow && hover && active !== null && size.height > 0 && (
        <ChartTooltip
          x={hover.x}
          y={activeTop + ROW_HEIGHT / 2}
          avoid={{ top: activeTop, bottom: activeTop + ROW_HEIGHT }}
          containerWidth={size.width}
          containerHeight={size.height}
          value={formatWidgetValue(w.field, activeRow.value)}
          unit={metricLabel(w, activeRow.value)}
          label={activeRow.key}
          extra={additive && total > 0 ? `${((activeRow.value / total) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% del total` : undefined}
        />
      )}
    </div>
  );
}
