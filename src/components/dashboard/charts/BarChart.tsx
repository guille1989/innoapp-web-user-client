import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { useAuth } from "../../../auth/AuthContext";
import { formatWidgetValue } from "../../../lib/aggregate";
import { fmtAxis, isAdditive, metricLabel, RANGE_LABELS, resolveRange, type RangePreset } from "../../../lib/chartScale";
import { ChartTooltip } from "./ChartTooltip";
import { RangePanel, RangePicker, type RangeView } from "./RangeControls";
import { useElementSize } from "./useElementSize";
import type { Widget } from "../../../types";

const ROW_HEIGHT = 26;

// Igual que en LineChart, el rango es una preferencia de quien mira y vive en
// localStorage. A diferencia de las líneas (que reciben datos diarios y filtran
// en el navegador), las barras llegan agrupadas por categoría, así que un rango
// distinto de "Todo" se pide al backend (`GET /widgets/{id}/data?dateFrom&dateTo`).
// El default es "Todo": los números que ya veía quien tiene barras no cambian solos.
const DEFAULT_VIEW: RangeView = { range: "all" };
const VIEW_STORAGE_KEY = "innoapp.widget-bar-view.v1";

function loadView(widgetId: string): RangeView {
  try {
    const saved = (JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) ?? "{}") as Record<string, Partial<RangeView>>)[widgetId];
    if (!saved?.range || !(saved.range in RANGE_LABELS)) return DEFAULT_VIEW;
    return { ...DEFAULT_VIEW, ...saved } as RangeView;
  } catch {
    return DEFAULT_VIEW;
  }
}

function saveView(widgetId: string, view: RangeView) {
  try {
    const all = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) ?? "{}") as Record<string, RangeView>;
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ ...all, [widgetId]: view }));
  } catch {
    // Sin storage (modo privado, cuota): la vista vuelve al default al recargar.
  }
}

type Row = { key: string; value: number };

/**
 * Barras horizontales: las categorías (productos, puertos, estados) son
 * texto y se leen enteras a la izquierda en vez de cortadas a 7px bajo una
 * columna. El backend ya las manda ordenadas de mayor a menor; se muestran
 * todas y la lista hace scroll cuando no entran en el alto del widget. El
 * tooltip queda fuera del área con scroll para acomodarse al alto visible
 * (debajo de la fila si entra, si no encima), no al de la lista entera.
 */
export function BarChart({ widget: w }: { widget: Widget }) {
  const { idToken } = useAuth();
  const [view, setView] = useState(() => loadView(w.id));
  const [editingRange, setEditingRange] = useState(false);
  const [ranged, setRanged] = useState<{ id: string; rows: Row[] } | null>(null);
  const [rangeError, setRangeError] = useState(false);
  const [chartRef, size] = useElementSize<HTMLDivElement>();
  const [scrollTop, setScrollTop] = useState(0);
  const [hover, setHover] = useState<{ index: number; x: number } | null>(null);
  useEffect(() => saveView(w.id, view), [w.id, view]);

  const range = resolveRange(view.range, view, undefined, undefined);
  const filtered = view.range !== "all";
  const requestKey = `${w.id}|${range.from}|${range.to}`;

  // `w.data` cambia con cada refresco general (cada 30 s): se vuelve a pedir el
  // rango para que la vista filtrada se mantenga al día igual que "Todo".
  useEffect(() => {
    if (!filtered || !idToken) return;
    let cancelled = false;
    api.widgetData(idToken, w.id, { dateFrom: range.from, dateTo: range.to })
      .then(({ data }) => {
        if (cancelled) return;
        setRanged({ id: requestKey, rows: data.map((row) => ({ key: row.label ?? "total", value: row.value })) });
        setRangeError(false);
      })
      .catch(() => { if (!cancelled) setRangeError(true); });
    return () => { cancelled = true; };
  }, [filtered, idToken, w.id, range.from, range.to, requestKey, w.data]);

  const loadingRange = filtered && !rangeError && ranged?.id !== requestKey;
  const rows: Row[] = filtered ? (ranged?.id === requestKey ? ranged.rows : []) : (w.data ?? []);

  function changeRange(preset: RangePreset) {
    if (preset === "custom") {
      setView((current) => ({ ...current, range: "custom", from: range.from, to: range.to }));
      setEditingRange(true);
    } else {
      setView((current) => ({ ...current, range: preset }));
      setEditingRange(false);
    }
    setHover(null);
  }

  const controls = (
    <div className="chart-controls">
      <RangePicker view={view} resolved={range} editing={editingRange} onChange={changeRange} onToggleEdit={() => setEditingRange((open) => !open)} />
    </div>
  );
  const rangePanel = editingRange && view.range === "custom" && (
    <RangePanel resolved={range} onFrom={(value) => setView((current) => ({ ...current, from: value }))} onTo={(value) => setView((current) => ({ ...current, to: value }))} onDone={() => setEditingRange(false)} />
  );

  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0) || 1;
  const additive = isAdditive(w);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const active = hover && hover.index < rows.length ? hover.index : null;
  const activeRow = active !== null ? rows[active] : undefined;
  const activeTop = active !== null ? active * ROW_HEIGHT - scrollTop : 0;
  const pointerX = (e: React.PointerEvent<HTMLElement>, list: Element | null) => e.clientX - (list?.getBoundingClientRect().left ?? 0);

  if (rows.length === 0) {
    const message = rangeError ? "No se pudieron cargar los datos del rango" : loadingRange ? "Cargando…" : filtered ? "Sin datos en este rango" : "Sin datos para esta agrupación";
    return (
      <div className="bar-chart">
        {controls}
        <div className="bar-body"><div className="bar-list"><span className="widget-empty">{message}</span></div>{rangePanel}</div>
      </div>
    );
  }

  return (
    <div className="bar-chart">
      {controls}
      <div
        className="bar-body"
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
        {rangePanel}
      </div>
    </div>
  );
}
