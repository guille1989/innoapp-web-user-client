import { useEffect, useState } from "react";
import { formatWidgetValue } from "../../../lib/aggregate";
import {
  DAY_KEY,
  buildTimeSeries,
  fmtAxis,
  metricLabel,
  fullPeriodLabel,
  niceTicks,
  periodEndKey,
  pickTickIndices,
  RANGE_LABELS,
  resolveRange,
  shortRangeLabel,
  tickLabel,
  type RangePreset,
  type TimeGranularity,
} from "../../../lib/chartScale";
import { ChartTooltip } from "./ChartTooltip";
import { RangePanel, RangePicker } from "./RangeControls";
import { useElementSize } from "./useElementSize";
import { useWidgetFontScale } from "../fontScale";
import type { Widget } from "../../../types";

const GRANULARITY_LABELS: Record<TimeGranularity, string> = { day: "Día", week: "Semana", month: "Mes" };

interface LineView {
  range: RangePreset;
  from?: string;
  to?: string;
  granularity: TimeGranularity;
}

const DEFAULT_VIEW: LineView = { range: "30d", granularity: "day" };
const VIEW_STORAGE_KEY = "innoapp.widget-view.v1";

// Rango y agrupación son preferencias de quien mira (igual que el layout
// del lienzo en DashboardView), no del widget: viven en localStorage y no
// tocan el backend. Los datos diarios ya llegan completos en
// `GET /widgets/{id}/data`, así que filtrar acá no cuesta otra consulta de Athena.
function loadView(widgetId: string): LineView {
  try {
    const saved = (JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) ?? "{}") as Record<string, Partial<LineView>>)[widgetId];
    if (!saved || !(saved.range && saved.range in RANGE_LABELS) || !(saved.granularity && saved.granularity in GRANULARITY_LABELS)) return DEFAULT_VIEW;
    return { ...DEFAULT_VIEW, ...saved };
  } catch {
    return DEFAULT_VIEW;
  }
}

function saveView(widgetId: string, view: LineView) {
  try {
    const all = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) ?? "{}") as Record<string, LineView>;
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ ...all, [widgetId]: view }));
  } catch {
    // Sin storage (modo privado, cuota): la vista vuelve al default al recargar.
  }
}

// Marcas del eje Y en JetBrains Mono 10px: ~6px por carácter.
const TICK_CHAR_PX = 6;
const BASE_MARGIN = { top: 18, right: 12, bottom: 20 };
const X_TICK_SPACING = 60;

export function LineChart({ widget: w }: { widget: Widget }) {
  const scale = useWidgetFontScale();
  const [view, setView] = useState(() => loadView(w.id));
  const [editingRange, setEditingRange] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [plotRef, size] = useElementSize<HTMLDivElement>();
  useEffect(() => saveView(w.id, view), [w.id, view]);

  const dailyRows = (w.data ?? []).filter((row) => DAY_KEY.test(row.key)).sort((a, b) => a.key.localeCompare(b.key));
  const range = resolveRange(view.range, view, dailyRows[0]?.key, dailyRows.at(-1)?.key);
  const points = buildTimeSeries(dailyRows, w, range, view.granularity);
  const hasDataInRange = dailyRows.some((row) => row.key >= range.from && row.key <= range.to);
  const activeIndex = active !== null && active < points.length ? active : null;

  function changeRange(preset: RangePreset) {
    if (preset === "custom") {
      setView((current) => ({ ...current, range: "custom", from: range.from, to: range.to }));
      setEditingRange(true);
    } else {
      setView((current) => ({ ...current, range: preset }));
      setEditingRange(false);
    }
    setActive(null);
  }

  const controls = (
    <div className="chart-controls">
      <RangePicker view={view} resolved={range} editing={editingRange} onChange={changeRange} onToggleEdit={() => setEditingRange((open) => !open)} />
      <div className="chart-segmented" role="group" aria-label="Agrupación temporal">
        {(Object.keys(GRANULARITY_LABELS) as TimeGranularity[]).map((item) => (
          <button key={item} type="button" className={view.granularity === item ? "active" : ""} aria-pressed={view.granularity === item} onClick={() => { setView((current) => ({ ...current, granularity: item })); setActive(null); }}>
            {GRANULARITY_LABELS[item]}
          </button>
        ))}
      </div>
    </div>
  );

  const rangePanel = editingRange && view.range === "custom" && (
    <RangePanel resolved={range} onFrom={(value) => setView((current) => ({ ...current, from: value }))} onTo={(value) => setView((current) => ({ ...current, to: value }))} onDone={() => setEditingRange(false)} />
  );

  if (!hasDataInRange) {
    return (
      <div className="line-chart">
        {controls}
        <div className="line-body">
          <div className="line-plot line-plot-empty"><span className="widget-empty">{dailyRows.length ? "Sin datos en este rango" : "Todavía no hay datos para graficar"}</span></div>
          {rangePanel}
        </div>
      </div>
    );
  }

  // --- Geometría en píxeles reales del contenedor ---
  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);
  const integer = w.field === "event_count" || (w.field === "quantity" && w.agg !== "avg");
  const MARGIN = { top: BASE_MARGIN.top * scale, right: BASE_MARGIN.right, bottom: BASE_MARGIN.bottom * scale };
  const plotHeight = Math.max(12, size.height - MARGIN.top - MARGIN.bottom);
  const ticks = niceTicks(minValue, maxValue, Math.min(5, Math.max(2, Math.floor(plotHeight / (30 * scale)))), integer);
  const tickLabels = ticks.map(fmtAxis);
  const left = Math.max(...tickLabels.map((label) => label.length)) * TICK_CHAR_PX * scale + 10;
  const plotWidth = Math.max(12, size.width - left - MARGIN.right);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const xAt = (index: number) => (points.length === 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth);
  const yAt = (value: number) => MARGIN.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
  const baseY = yAt(Math.min(Math.max(0, yMin), yMax));

  // Los periodos sin valor (promedios/máximos de días sin tickets) cortan la línea en vez de inventar un 0.
  const segments: Array<Array<[number, number]>> = [];
  let currentSegment: Array<[number, number]> = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (currentSegment.length) segments.push(currentSegment);
      currentSegment = [];
    } else {
      currentSegment.push([xAt(index), yAt(point.value)]);
    }
  });
  if (currentSegment.length) segments.push(currentSegment);
  const toPath = (segment: Array<[number, number]>) => segment.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const lines = segments.filter((segment) => segment.length > 1);
  const linePath = lines.map(toPath).join("");
  const areaPath = lines.map((segment) => `${toPath(segment)}L${segment[segment.length - 1][0].toFixed(1)},${baseY.toFixed(1)}L${segment[0][0].toFixed(1)},${baseY.toFixed(1)}Z`).join("");
  const isolated = segments.filter((segment) => segment.length === 1).map((segment) => segment[0]);

  // Etiquetas selectivas: el último valor siempre, el máximo solo si no es el último ni queda pegado a él.
  let lastIndex = -1;
  let maxIndex = -1;
  points.forEach((point, index) => {
    if (point.value === null) return;
    lastIndex = index;
    if (maxIndex < 0 || point.value > (points[maxIndex].value ?? -Infinity)) maxIndex = index;
  });
  const showMax = maxIndex >= 0 && maxIndex !== lastIndex && maxValue > 0 && Math.abs(xAt(maxIndex) - xAt(lastIndex)) > 52 * scale;
  const labelled = [lastIndex, ...(showMax ? [maxIndex] : [])].filter((index) => index >= 0);

  const xTicks = pickTickIndices(points.length, Math.floor(plotWidth / (X_TICK_SPACING * scale)), view.granularity);
  const anchorFor = (x: number) => (x < left + 18 ? "start" : x > left + plotWidth - 18 ? "end" : "middle");

  function indexAt(clientX: number, element: HTMLElement): number {
    if (points.length === 1) return 0;
    const x = clientX - element.getBoundingClientRect().left;
    return Math.min(points.length - 1, Math.max(0, Math.round(((x - left) / plotWidth) * (points.length - 1))));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const last = points.length - 1;
    const moves: Record<string, (index: number) => number> = {
      ArrowLeft: (index) => Math.max(0, index - 1),
      ArrowRight: (index) => Math.min(last, index + 1),
      Home: () => 0,
      End: () => last,
    };
    if (e.key === "Escape") setActive(null);
    if (!moves[e.key]) return;
    e.preventDefault();
    setActive((index) => moves[e.key](index ?? Math.max(0, lastIndex)));
  }

  const unitFor = (value: number) => metricLabel(w, value);
  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const partial = activePoint && view.granularity !== "day" && (activePoint.key < range.from || periodEndKey(activePoint.key, view.granularity) > range.to);
  const summary = `${w.title}, ${shortRangeLabel(range.from, range.to)}. Máximo ${formatWidgetValue(w.field, maxValue)} ${unitFor(maxValue)}${maxIndex >= 0 ? ` (${fullPeriodLabel(points[maxIndex].key, view.granularity)})` : ""}. Usa las flechas para recorrer los periodos.`;

  return (
    <div className="line-chart">
      {controls}
      <div className="line-body">
        <div
          className="line-plot"
          ref={plotRef}
          tabIndex={0}
          role="group"
          aria-label={summary}
          onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget))}
          onPointerDown={(e) => setActive(indexAt(e.clientX, e.currentTarget))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {size.width > 0 && (
            <svg width={size.width} height={size.height} aria-hidden="true">
              <defs>
                <linearGradient id={`line-fill-${w.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--teal)" stopOpacity=".16" />
                  <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((tick, index) => (
                <g key={tick}>
                  <line className={tick === 0 ? "chart-baseline" : "chart-grid"} x1={left} x2={left + plotWidth} y1={yAt(tick)} y2={yAt(tick)} />
                  <text className="chart-tick" x={left - 8} y={yAt(tick)} dy="0.32em" textAnchor="end">{tickLabels[index]}</text>
                </g>
              ))}
              {xTicks.map((index) => (
                <text key={points[index].key} className="chart-tick chart-tick-x" x={xAt(index)} y={size.height - 5 * scale} textAnchor={anchorFor(xAt(index))}>
                  {tickLabel(points[index].key, view.granularity)}
                </text>
              ))}
              {areaPath && <path d={areaPath} fill={`url(#line-fill-${w.id})`} />}
              {linePath && <path className="line-stroke" d={linePath} />}
              {isolated.map(([x, y]) => <circle key={`${x}-${y}`} className="line-dot-small" cx={x} cy={y} r={2.5} />)}
              {activeIndex !== null && <line className="chart-crosshair" x1={xAt(activeIndex)} x2={xAt(activeIndex)} y1={MARGIN.top - 6} y2={MARGIN.top + plotHeight} />}
              {labelled.map((index) => {
                const value = points[index].value ?? 0;
                const x = xAt(index);
                const y = yAt(value);
                const labelY = y - 10 < 10 * scale ? y + 18 * scale : y - 10;
                return (
                  <g key={`label-${index}`} className={activeIndex !== null ? "line-callout faded" : "line-callout"}>
                    <circle className="line-marker" cx={x} cy={y} r={4} />
                    <text className={index === lastIndex ? "chart-value" : "chart-value secondary"} x={x} y={labelY} textAnchor={anchorFor(x)}>{fmtAxis(value)}</text>
                  </g>
                );
              })}
              {activePoint && activePoint.value !== null && <circle className="line-marker active" cx={xAt(activeIndex!)} cy={yAt(activePoint.value)} r={4.5} />}
            </svg>
          )}
          {activePoint && size.width > 0 && (
            <ChartTooltip
              x={xAt(activeIndex!)}
              y={activePoint.value !== null ? yAt(activePoint.value) : MARGIN.top}
              containerWidth={size.width}
              containerHeight={size.height}
              value={activePoint.value === null ? "Sin datos" : formatWidgetValue(w.field, activePoint.value)}
              unit={activePoint.value === null ? "" : unitFor(activePoint.value)}
              label={fullPeriodLabel(activePoint.key, view.granularity)}
              extra={partial ? "Periodo parcial: solo cuenta los días del rango" : undefined}
            />
          )}
        </div>
        {rangePanel}
      </div>
      <table className="sr-only">
        <caption>{w.title}</caption>
        <thead><tr><th scope="col">Periodo</th><th scope="col">Valor</th></tr></thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{fullPeriodLabel(point.key, view.granularity)}</th>
              <td>{point.value === null ? "Sin datos" : formatWidgetValue(w.field, point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
