import { useRef, useState } from "react";
import { formatWidgetValue } from "../../../lib/aggregate";
import { fmtAxis, isAdditive, metricLabel } from "../../../lib/chartScale";
import { CHART_OTHER_COLOR, CHART_PALETTE } from "../../../data/widgetLabels";
import { useElementSize } from "./useElementSize";
import type { AggregateRow, Widget } from "../../../types";

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
  members: number;
}

/**
 * Cada categoría conserva su color entre refrescos (cada 30s) aunque cambie
 * de puesto: el color sigue a la categoría, no a su ranking. Si quedan
 * huecos en la secuencia de colores (desapareció una categoría y no entró
 * otra) se reasigna todo en orden — los colores solo están validados como
 * vecinos en ese orden (ver CHART_PALETTE).
 */
function assignSlots(memory: Map<string, number>, keys: string[]): number[] {
  const taken = new Set<number>();
  const kept = keys.map((key) => {
    const slot = memory.get(key);
    if (slot === undefined || slot >= keys.length || taken.has(slot)) return -1;
    taken.add(slot);
    return slot;
  });
  const slots = kept.map((slot, index) => {
    if (slot >= 0) return slot;
    let free = 0;
    while (taken.has(free)) free++;
    taken.add(free);
    memory.set(keys[index], free);
    return free;
  });
  return slots;
}

function buildSlices(rows: AggregateRow[], memory: Map<string, number>, additive: boolean): { slices: Slice[]; hidden: number } {
  const positive = rows.filter((row) => row.value > 0);
  const overflow = positive.length > CHART_PALETTE.length;
  const head = overflow ? positive.slice(0, CHART_PALETTE.length) : positive;
  const rest = overflow ? positive.slice(CHART_PALETTE.length) : [];
  const slots = assignSlots(memory, head.map((row) => row.key));
  const slices = head
    .map((row, index) => ({ key: row.key, label: row.key, value: row.value, color: CHART_PALETTE[slots[index]], members: 1, slot: slots[index] }))
    .sort((a, b) => a.slot - b.slot)
    .map(({ slot: _slot, ...slice }) => slice);
  // "Otros" solo tiene sentido si los valores se pueden sumar (tickets, sumas);
  // un "promedio de los demás" sumado no significa nada.
  if (rest.length && additive) {
    slices.push({ key: "__other__", label: rest.length === 1 ? rest[0].key : `Otros (${rest.length})`, value: rest.reduce((sum, row) => sum + row.value, 0), color: CHART_OTHER_COLOR, members: rest.length });
    return { slices, hidden: 0 };
  }
  return { slices, hidden: rest.length };
}

function arcPath(start: number, end: number, outer: number, inner: number, center: number): string {
  if (end - start >= Math.PI * 2 - 1e-6) {
    // Anillo completo: un arco SVG no puede empezar y terminar en el mismo punto.
    return `M${center - outer},${center}a${outer},${outer} 0 1,0 ${outer * 2},0a${outer},${outer} 0 1,0 ${-outer * 2},0`
      + `M${center - inner},${center}a${inner},${inner} 0 1,1 ${inner * 2},0a${inner},${inner} 0 1,1 ${-inner * 2},0Z`;
  }
  const point = (radius: number, angle: number) => `${(center + radius * Math.sin(angle)).toFixed(2)},${(center - radius * Math.cos(angle)).toFixed(2)}`;
  const large = end - start > Math.PI ? 1 : 0;
  return `M${point(outer, start)}A${outer},${outer} 0 ${large} 1 ${point(outer, end)}L${point(inner, end)}A${inner},${inner} 0 ${large} 0 ${point(inner, start)}Z`;
}

export function DonutChart({ widget: w }: { widget: Widget }) {
  const rows = w.data ?? [];
  const slotMemory = useRef(new Map<string, number>());
  const [active, setActive] = useState<string | null>(null);
  const [ringRef, size] = useElementSize<HTMLDivElement>();
  const additive = isAdditive(w);

  const { slices, hidden } = buildSlices(rows, slotMemory.current, additive);
  if (slices.length === 0) return <div className="donut-wrap"><span className="widget-empty">Sin datos para esta agrupación</span></div>;

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const share = (value: number) => `${((value / total) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
  const activeSlice = slices.find((slice) => slice.key === active);
  const diameter = Math.max(0, Math.min(size.width, size.height));
  const outer = diameter / 2 - 1;
  const inner = outer * 0.66;
  let angle = 0;

  return (
    <div className="donut-wrap" onPointerLeave={() => setActive(null)}>
      <div className="donut-ring" ref={ringRef}>
        {diameter > 0 && (
          <svg width={diameter} height={diameter} aria-hidden="true">
            {slices.map((slice) => {
              const start = angle;
              angle += (slice.value / total) * Math.PI * 2;
              return (
                <path
                  key={slice.key}
                  className={`donut-slice${active && active !== slice.key ? " dimmed" : ""}`}
                  d={arcPath(start, angle, outer, inner, diameter / 2)}
                  fill={slice.color}
                  fillRule="evenodd"
                  onPointerEnter={() => setActive(slice.key)}
                />
              );
            })}
          </svg>
        )}
        <div className="donut-center" aria-live="polite">
          {activeSlice ? (
            <>
              <strong>{fmtAxis(activeSlice.value)}</strong>
              <span>{additive ? share(activeSlice.value) : metricLabel(w, activeSlice.value)}</span>
            </>
          ) : additive ? (
            <>
              <strong>{fmtAxis(total)}</strong>
              <span>{w.field === "event_count" ? metricLabel(w, total) : "total"}</span>
            </>
          ) : null}
        </div>
      </div>
      <ul className="donut-legend">
        {slices.map((slice) => (
          <li
            key={slice.key}
            className={`legend-row${active === slice.key ? " active" : ""}${active && active !== slice.key ? " dimmed" : ""}`}
            tabIndex={0}
            aria-label={`${slice.label}: ${formatWidgetValue(w.field, slice.value)} ${metricLabel(w, slice.value)}${additive ? `, ${share(slice.value)}` : ""}`}
            onPointerEnter={() => setActive(slice.key)}
            onFocus={() => setActive(slice.key)}
            onBlur={() => setActive(null)}
          >
            <i style={{ background: slice.color }} />
            <span title={slice.label}>{slice.label}</span>
            <b>{formatWidgetValue(w.field, slice.value)}</b>
            {additive && <small>{share(slice.value)}</small>}
          </li>
        ))}
        {hidden > 0 && <li className="legend-more">+{hidden} más</li>}
      </ul>
    </div>
  );
}
