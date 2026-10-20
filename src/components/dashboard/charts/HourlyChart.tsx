import { useState } from "react";
import { formatWidgetValue } from "../../../lib/aggregate";
import { fmtAxis, isAdditive, localDateKey, metricLabel, niceTicks } from "../../../lib/chartScale";
import { ChartTooltip } from "./ChartTooltip";
import { useElementSize } from "./useElementSize";
import { useWidgetFontScale } from "../fontScale";
import type { Widget } from "../../../types";

/**
 * Evolución hora por hora de hoy contra ayer. Las claves del backend son
 * "YYYY-MM-DD HH" en la zona del navegador (`?tz=`, ver api/client.ts), así
 * que acá se comparan tal cual, sin pasar por Date. `useCloudData` solo pide
 * ayer y hoy para estos widgets.
 *
 * Sumas y conteos se dibujan ACUMULADOS durante el día (la curva siempre
 * sube: "¿voy mejor o peor que ayer a esta hora?"). Promedio/máximo/mínimo no
 * se pueden acumular, así que van hora por hora.
 */

const HOUR_KEY = /^(\d{4}-\d{2}-\d{2}) (\d{2})$/;
const TICK_CHAR_PX = 6;
const BASE_MARGIN = { top: 18, right: 12, bottom: 20 };
// Con "+38" sobre el valor final hace falta una línea más de aire arriba.
const DELTA_TOP = 32;
const X_TICK_SPACING = 40;
const HOUR_TICK_STEPS = [1, 2, 3, 4, 6, 12];

type Values = Array<number | null>;

interface HourSeries {
  hours: number[];
  today: Values;
  /** null si ayer no tiene datos. */
  yesterday: Values | null;
  cumulative: boolean;
}

function hourLabel(hour: number): string {
  return `${hour}h`;
}

function hoursByKey(data: Widget["data"], dayKey: string): Map<number, number> {
  const byHour = new Map<number, number>();
  for (const row of data ?? []) {
    const match = HOUR_KEY.exec(row.key);
    if (match && match[1] === dayKey) byHour.set(Number(match[2]), row.value);
  }
  return byHour;
}

function buildSeries(widget: Pick<Widget, "data" | "field" | "agg">): HourSeries | null {
  const today = hoursByKey(widget.data, localDateKey(0));
  const yesterday = hoursByKey(widget.data, localDateKey(-1));
  if (today.size === 0 && yesterday.size === 0) return null;

  const first = Math.min(...today.keys(), ...yesterday.keys());
  // Hoy llega hasta la hora actual aunque no haya ventas todavía; ayer se corta
  // en esa misma hora para comparar "a esta hora" y no contra el día completo.
  const last = Math.max(first, ...today.keys(), new Date().getHours());
  const hours: number[] = [];
  for (let hour = first; hour <= last; hour++) hours.push(hour);

  const additive = isAdditive(widget);
  const toValues = (byHour: Map<number, number>): Values => {
    let running = 0;
    return hours.map((hour) => {
      const value = byHour.get(hour);
      if (!additive) return value ?? null;
      running += value ?? 0;
      return running;
    });
  };
  return { hours, today: toValues(today), yesterday: yesterday.size ? toValues(yesterday) : null, cumulative: additive };
}

function pickHourTicks(count: number, maxTicks: number): number[] {
  const limit = Math.max(1, maxTicks);
  const step = HOUR_TICK_STEPS.find((candidate) => Math.ceil(count / candidate) <= limit) ?? Math.ceil(count / limit);
  const indices: number[] = [];
  for (let index = count - 1; index >= 0; index -= step) indices.push(index);
  return indices.reverse();
}

const PCT = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

function signed(value: number, text: string): string {
  return value > 0 ? `+${text}` : text;
}

export function HourlyChart({ widget: w }: { widget: Widget }) {
  const scale = useWidgetFontScale();
  const [active, setActive] = useState<number | null>(null);
  const [plotRef, size] = useElementSize<HTMLDivElement>();

  const series = buildSeries(w);

  if (!series) {
    return (
      <div className="line-chart">
        <div className="line-body">
          <div className="line-plot line-plot-empty"><span className="widget-empty">Todavía no hay datos para graficar</span></div>
        </div>
      </div>
    );
  }

  const { hours, today, yesterday, cumulative } = series;
  const count = hours.length;
  const activeIndex = active !== null && active < count ? active : null;

  let lastIndex = -1;
  today.forEach((value, index) => { if (value !== null) lastIndex = index; });
  const todayEnd = lastIndex >= 0 ? (today[lastIndex] as number) : null;
  const yesterdayEnd = yesterday && lastIndex >= 0 ? yesterday[lastIndex] : null;
  const delta = cumulative && todayEnd !== null && yesterdayEnd !== null ? todayEnd - yesterdayEnd : null;
  const pct = delta !== null && yesterdayEnd ? (delta / yesterdayEnd) * 100 : null;

  const subtitle = cumulative
    ? `Acumulado del día${pct !== null ? ` · ${signed(pct, PCT.format(pct))} % vs ayer` : ""}`
    : `Por hora${yesterday ? " · hoy vs ayer" : ""}`;

  const values = [...today, ...(yesterday ?? [])].flatMap((value) => (value === null ? [] : [value]));
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);
  const integer = w.field === "event_count" || (w.field === "quantity" && w.agg !== "avg");
  const MARGIN = { top: (delta !== null ? DELTA_TOP : BASE_MARGIN.top) * scale, right: BASE_MARGIN.right, bottom: BASE_MARGIN.bottom * scale };
  const plotHeight = Math.max(12, size.height - MARGIN.top - MARGIN.bottom);
  const ticks = niceTicks(minValue, maxValue, Math.min(5, Math.max(2, Math.floor(plotHeight / (30 * scale)))), integer);
  const tickLabels = ticks.map(fmtAxis);
  const left = Math.max(...tickLabels.map((label) => label.length)) * TICK_CHAR_PX * scale + 10;
  const plotWidth = Math.max(12, size.width - left - MARGIN.right);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const xAt = (index: number) => (count === 1 ? left + plotWidth / 2 : left + (index / (count - 1)) * plotWidth);
  const yAt = (value: number) => MARGIN.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
  const baseY = yAt(Math.min(Math.max(0, yMin), yMax));

  // Las horas sin valor (promedios/máximos de horas sin tickets) cortan la línea en vez de inventar un 0.
  const toSegments = (list: Values): Array<Array<[number, number]>> => {
    const segments: Array<Array<[number, number]>> = [];
    let current: Array<[number, number]> = [];
    list.forEach((value, index) => {
      if (value === null) {
        if (current.length) segments.push(current);
        current = [];
      } else {
        current.push([xAt(index), yAt(value)]);
      }
    });
    if (current.length) segments.push(current);
    return segments;
  };
  const toPath = (segment: Array<[number, number]>) => segment.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

  const todaySegments = toSegments(today);
  const lines = todaySegments.filter((segment) => segment.length > 1);
  const linePath = lines.map(toPath).join("");
  const areaPath = lines.map((segment) => `${toPath(segment)}L${segment[segment.length - 1][0].toFixed(1)},${baseY.toFixed(1)}L${segment[0][0].toFixed(1)},${baseY.toFixed(1)}Z`).join("");
  const isolated = todaySegments.filter((segment) => segment.length === 1).map((segment) => segment[0]);
  const yesterdayPath = yesterday ? toSegments(yesterday).filter((segment) => segment.length > 1).map(toPath).join("") : "";

  // Sin acumular, además del último valor se marca el máximo; acumulado, el máximo ES el último.
  let maxIndex = -1;
  today.forEach((value, index) => {
    if (value !== null && (maxIndex < 0 || value > (today[maxIndex] ?? -Infinity))) maxIndex = index;
  });
  const showMax = !cumulative && maxIndex >= 0 && maxIndex !== lastIndex && maxValue > 0 && Math.abs(xAt(maxIndex) - xAt(lastIndex)) > 52 * scale;
  const labelled = [lastIndex, ...(showMax ? [maxIndex] : [])].filter((index) => index >= 0);

  const xTicks = pickHourTicks(count, Math.floor(plotWidth / (X_TICK_SPACING * scale)));
  const anchorFor = (x: number) => (x < left + 12 ? "start" : x > left + plotWidth - 12 ? "end" : "middle");

  function indexAt(clientX: number, element: HTMLElement): number {
    if (count === 1) return 0;
    const x = clientX - element.getBoundingClientRect().left;
    return Math.min(count - 1, Math.max(0, Math.round(((x - left) / plotWidth) * (count - 1))));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const end = count - 1;
    const moves: Record<string, (index: number) => number> = {
      ArrowLeft: (index) => Math.max(0, index - 1),
      ArrowRight: (index) => Math.min(end, index + 1),
      Home: () => 0,
      End: () => end,
    };
    if (e.key === "Escape") setActive(null);
    if (!moves[e.key]) return;
    e.preventDefault();
    setActive((index) => moves[e.key](index ?? Math.max(0, lastIndex)));
  }

  const fullHourLabel = (hour: number) => (cumulative ? `Hoy, hasta las ${hour}:59` : `Hoy, ${hour}:00 – ${hour}:59`);
  const unitFor = (value: number) => metricLabel(w, value);
  const fmt = (value: number) => formatWidgetValue(w.field, value);
  const activeValue = activeIndex !== null ? today[activeIndex] : null;
  const activeYesterday = activeIndex !== null && yesterday ? yesterday[activeIndex] : null;
  const summary = `${w.title}, ${subtitle.toLowerCase()}. ${todayEnd !== null ? `Hoy ${fmt(todayEnd)} ${unitFor(todayEnd)}` : "Sin ventas hoy"}${yesterdayEnd !== null ? `, ayer a esta hora ${fmt(yesterdayEnd)}` : ""}. Usa las flechas para recorrer las horas.`;

  // El "+38" va justo encima del valor final: debajo la curva llega desde la izquierda y lo taparía.
  const endX = lastIndex >= 0 ? xAt(lastIndex) : 0;
  const deltaY = (todayEnd !== null ? yAt(todayEnd) : 0) - 23 * scale;

  return (
    <div className="line-chart">
      <div className="hourly-head">
        <span className="hourly-sub">{subtitle}</span>
        <span className="hourly-legend" aria-hidden="true">
          <span className="hourly-key"><i className="hourly-swatch" />Hoy</span>
          {yesterday && <span className="hourly-key"><i className="hourly-swatch prev" />Ayer</span>}
        </span>
      </div>
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
                <text key={hours[index]} className="chart-tick chart-tick-x" x={xAt(index)} y={size.height - 5 * scale} textAnchor={anchorFor(xAt(index))}>
                  {hourLabel(hours[index])}
                </text>
              ))}
              {areaPath && <path d={areaPath} fill={`url(#hour-fill-${w.id})`} />}
              {yesterdayPath && <path className="line-stroke-prev" d={yesterdayPath} />}
              {linePath && <path className="line-stroke" d={linePath} />}
              {isolated.map(([x, y]) => <circle key={`${x}-${y}`} className="line-dot-small" cx={x} cy={y} r={2.5} />)}
              {activeIndex !== null && <line className="chart-crosshair" x1={xAt(activeIndex)} x2={xAt(activeIndex)} y1={MARGIN.top - 6} y2={MARGIN.top + plotHeight} />}
              {labelled.map((index) => {
                const value = today[index] ?? 0;
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
              {delta !== null && (
                <text className={delta >= 0 ? "chart-delta" : "chart-delta neg"} x={endX} y={deltaY} textAnchor={anchorFor(endX)} opacity={activeIndex !== null ? 0.35 : 1}>
                  {signed(delta, fmtAxis(delta))}
                </text>
              )}
              {activeValue !== null && <circle className="line-marker active" cx={xAt(activeIndex!)} cy={yAt(activeValue)} r={4.5} />}
            </svg>
          )}
          {activeIndex !== null && size.width > 0 && (
            <ChartTooltip
              x={xAt(activeIndex)}
              y={activeValue !== null ? yAt(activeValue) : MARGIN.top}
              containerWidth={size.width}
              containerHeight={size.height}
              value={activeValue === null ? "Sin datos" : fmt(activeValue)}
              unit={activeValue === null ? "" : unitFor(activeValue)}
              label={fullHourLabel(hours[activeIndex])}
              extra={activeYesterday !== null ? `Ayer a esta hora: ${fmt(activeYesterday)}` : undefined}
            />
          )}
        </div>
      </div>
      <table className="sr-only">
        <caption>{w.title}</caption>
        <thead><tr><th scope="col">Hora</th><th scope="col">Hoy</th><th scope="col">Ayer</th></tr></thead>
        <tbody>
          {hours.map((hour, index) => (
            <tr key={hour}>
              <th scope="row">{hourLabel(hour)}</th>
              <td>{today[index] === null ? "Sin datos" : fmt(today[index] as number)}</td>
              <td>{yesterday === null || yesterday[index] === null ? "Sin datos" : fmt(yesterday[index] as number)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
