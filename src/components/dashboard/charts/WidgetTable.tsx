import { useState } from "react";
import { formatWidgetValue } from "../../../lib/aggregate";
import { DAY_KEY, buildTimeSeries, isAdditive, metricLabel, resolveRange } from "../../../lib/chartScale";
import { GROUP_LABELS } from "../../../data/widgetLabels";
import { usePeriod } from "../../../lib/periodFilter";
import type { Widget } from "../../../types";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// "2026-11-03" → día 3, martes, noviembre. A mano (sin Intl) para no depender del navegador;
// la fecha se arma con componentes locales, así que no hay corrimiento por zona horaria.
function dayParts(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { day, weekday: WEEKDAYS[new Date(year, month - 1, day).getDay()], month: MONTHS[month - 1] };
}

type Row = { key: string; label: string; value: number | null };
type Sort = "none" | "desc" | "asc";

/**
 * Tabla Fecha | valor (o Categoría | valor). Por día muestra todos los días del
 * período (0 donde no hubo ventas) en orden cronológico, con la fecha como chip
 * "día | día de la semana | mes"; por categoría, el orden del backend (mayor a
 * menor). El encabezado del valor ordena (sin orden → mayor a menor → menor a
 * mayor). Con métricas sumables suma una fila de total fija al pie.
 */
export function WidgetTable({ widget: w }: { widget: Widget }) {
  const [period] = usePeriod();
  const [sort, setSort] = useState<Sort>("none");
  const byDay = w.group === "day";
  const additive = isAdditive(w);

  let rows: Row[];
  if (byDay) {
    const daily = (w.data ?? []).filter((row) => DAY_KEY.test(row.key)).sort((a, b) => a.key.localeCompare(b.key));
    const range = resolveRange(period.preset, period, daily[0]?.key, daily.at(-1)?.key);
    rows = buildTimeSeries(daily, w, range, "day").map((p) => ({ key: p.key, label: p.key, value: p.value }));
  } else {
    rows = (w.data ?? []).map((row) => ({ key: row.key, label: w.keyLabels?.[row.key] ?? row.key, value: row.value }));
  }

  if (rows.length === 0 || (byDay && rows.every((r) => !r.value))) {
    return <div className="widget-table"><span className="widget-empty">{period.preset === "all" ? "Sin datos para esta agrupación" : "Sin datos en este período"}</span></div>;
  }

  if (sort !== "none") {
    const dir = sort === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => dir * ((a.value ?? 0) - (b.value ?? 0)));
  }

  const valueHeader = metricLabel(w, 2);
  const total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const nextSort: Sort = sort === "none" ? "desc" : sort === "desc" ? "asc" : "none";

  return (
    <div className="widget-table">
      <div className="widget-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{byDay ? "Fecha" : GROUP_LABELS[w.group ?? "port"]}</th>
              <th className="n" aria-sort={sort === "none" ? "none" : sort === "desc" ? "descending" : "ascending"}>
                <button type="button" className={`wt-sort ${sort}`} onClick={() => setSort(nextSort)} aria-label={`Ordenar por ${valueHeader}`}>
                  <span>{valueHeader}</span>
                  <svg viewBox="0 0 10 14" aria-hidden="true">
                    <path className="up" d="M5 1 8.5 5h-7z" />
                    <path className="down" d="M5 13 1.5 9h7z" />
                  </svg>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const parts = byDay ? dayParts(row.key) : null;
              return (
                <tr key={row.key}>
                  <td>
                    {parts ? (
                      <span className="wt-chip">
                        <b className="wt-day">{parts.day}</b>
                        <span className="wt-weekday">{parts.weekday}</span>
                        <span className="wt-month"><span className="wt-long">{parts.month}</span><span className="wt-short">{parts.month.slice(0, 3)}</span></span>
                      </span>
                    ) : (
                      row.label
                    )}
                  </td>
                  <td className={`n${!row.value ? " zero" : ""}`}>{row.value === null ? "—" : formatWidgetValue(w.field, row.value)}</td>
                </tr>
              );
            })}
          </tbody>
          {additive && (
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="n">{formatWidgetValue(w.field, total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
