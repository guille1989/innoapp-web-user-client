import { useState } from "react";
import { formatWidgetValue } from "../../../lib/aggregate";
import { fmtAxis, isAdditive, localDateKey, metricLabel, niceTicks } from "../../../lib/chartScale";
import { ChartTooltip } from "./ChartTooltip";
import { useElementSize } from "./useElementSize";
import { useWidgetFontScale } from "../fontScale";
import type { Widget } from "../../../types";

/**
 * Evolución hora por hora de UN día (hoy o ayer). Las claves del backend son
 * "YYYY-MM-DD HH" en la zona del navegador (`?tz=`, ver api/client.ts), así
 * que acá se comparan tal cual, sin pasar por Date. `useCloudData` solo pide
 * ayer y hoy para estos widgets.
 */

type Day = "today" | "yesterday";
const DAY_LABELS: Record<Day, string> = { today: "Hoy", yesterday: "Ayer" };

const HOUR_KEY = /^(\d{4}-\d{2}-\d{2}) (\d{2})$/;
const TICK_CHAR_PX = 6;
const BASE_MARGIN = { top: 18, right: 12, bottom: 20 };
const X_TICK_SPACING = 40;
const HOUR_TICK_STEPS = [1, 2, 3, 4, 6, 12];

interface HourPoint {
  hour: number;
  value: number | null;
}

function hourLabel(hour: number): string {
  return `${hour}h`;
}

function buildHourSeries(widget: Pick<Widget, "data" | "field" | "agg">, dayKey: string, isToday: boolean): HourPoint[] {
  const byHour = new Map<number, number>();
  for (const row of widget.data ?? []) {
    const match = HOUR_KEY.exec(row.key);
    if (match && match[1] === dayKey) byHour.set(Number(match[2]), row.value);
  }
  if (byHour.size === 0) return [];
  const hours = [...byHour.keys()];
  const first = Math.min(...hours);
  // Hoy llega hasta la hora actual aunque no haya ventas todavía: la curva no "termina" antes de tiempo.
  const last = Math.max(...hours, isToday ? new Date().getHours() : -1);
  const empty = isAdditive(widget) ? 0 : null;
  const points: HourPoint[] = [];
  for (let hour = first; hour <= last; hour++) points.push({ hour, value: byHour.get(hour) ?? empty });
  return points;
}

function pickHourTicks(count: number, maxTicks: number): number[] {
  const limit = Math.max(1, maxTicks);
  const step = HOUR_TICK_STEPS.find((candidate) => Math.ceil(count / candidate) <= limit) ?? Math.ceil(count / limit);
  const indices: number[] = [];
  for (let index = count - 1; index >= 0; index -= step) indices.push(index);
  return indices.reverse();
}

export function HourlyChart({ widget: w }: { widget: Widget }) {
  const scale = useWidgetFontScale();
  const [day, setDay] = useState<Day>("today");
  const [active, setActive] = useState<number | null>(null);
  const [plotRef, size] = useElementSize<HTMLDivElement>();

  const dayKey = localDateKey(day === "today" ? 0 : -1);
  const points = buildHourSeries(w, dayKey, day === "today");
  const activeIndex = active !== null && active < points.length ? active : null;

  const controls = (
    <div className="chart-controls">
      <div className="chart-segmented" role="group" aria-label="Día">
        {(Object.keys(DAY_LABELS) as Day[]).map((item) => (
          <button key={item} type="button" className={day === item ? "active" : ""} aria-pressed={day === item} onClick={() => { setDay(item); setActive(null); }}>
            {DAY_LABELS[item]}
          </button>
        ))}
      </div>
    </div>
  );

  if (points.length === 0) {
    return (
      <div className="line-chart">
        {controls}
        <div className="line-body">
          <div className="line-plot line-plot-empty">
            <span className="widget-empty">{(w.data ?? []).length ? `Sin ventas ${day === "today" ? "hoy" : "ayer"}` : "Todavía no hay datos para graficar"}</span>
          </div>
        </div>
      </div>
    );
  }

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

  // Las horas sin valor (promedios/máximos de horas sin tickets) cortan la línea en vez de inventar un 0.
  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push([xAt(index), yAt(point.value)]);
    }
  });
  if (current.length) segments.push(current);
  const toPath = (segment: Array<[number, number]>) => segment.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const lines = segments.filter((segment) => segment.length > 1);
  const linePath = lines.map(toPath).join("");
  const areaPath = lines.map((segment) => `${toPath(segment)}L${segment[segment.length - 1][0].toFixed(1)},${baseY.toFixed(1)}L${segment[0][0].toFixed(1)},${baseY.toFixed(1)}Z`).join("");
  const isolated = segments.filter((segment) => segment.length === 1).map((segment) => segment[0]);

  let lastIndex = -1;
  let maxIndex = -1;
  points.forEach((point, index) => {
    if (point.value === null) return;
    lastIndex = index;
    if (maxIndex < 0 || point.value > (points[maxIndex].value ?? -Infinity)) maxIndex = index;
  });
  const showMax = maxIndex >= 0 && maxIndex !== lastIndex && maxValue > 0 && Math.abs(xAt(maxIndex) - xAt(lastIndex)) > 52 * scale;
  const labelled = [lastIndex, ...(showMax ? [maxIndex] : [])].filter((index) => index >= 0);

  const xTicks = pickHourTicks(points.length, Math.floor(plotWidth / (X_TICK_SPACING * scale)));
  const anchorFor = (x: number) => (x < left + 12 ? "start" : x > left + plotWidth - 12 ? "end" : "middle");

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

  const fullHourLabel = (hour: number) => `${DAY_LABELS[day]}, ${hour}:00 – ${hour}:59`;
  const unitFor = (value: number) => metricLabel(w, value);
  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const summary = `${w.title}, ${DAY_LABELS[day].toLowerCase()} hora por hora. Máximo ${formatWidgetValue(w.field, maxValue)} ${unitFor(maxValue)}${maxIndex >= 0 ? ` (${fullHourLabel(points[maxIndex].hour)})` : ""}. Usa las flechas para recorrer las horas.`;

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
                <linearGradient id={`hour-fill-${w.id}`} x1="0" y1="0" x2="0" y2="1">
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
                <text key={points[index].hour} className="chart-tick chart-tick-x" x={xAt(index)} y={size.height - 5 * scale} textAnchor={anchorFor(xAt(index))}>
                  {hourLabel(points[index].hour)}
                </text>
              ))}
              {areaPath && <path d={areaPath} fill={`url(#hour-fill-${w.id})`} />}
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
              label={fullHourLabel(activePoint.hour)}
            />
          )}
        </div>
      </div>
      <table className="sr-only">
        <caption>{w.title}</caption>
        <thead><tr><th scope="col">Hora</th><th scope="col">Valor</th></tr></thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.hour}>
              <th scope="row">{fullHourLabel(point.hour)}</th>
              <td>{point.value === null ? "Sin datos" : formatWidgetValue(w.field, point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
