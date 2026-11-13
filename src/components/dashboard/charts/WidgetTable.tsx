import { formatWidgetValue } from "../../../lib/aggregate";
import { DAY_KEY, buildTimeSeries, isAdditive, metricLabel, resolveRange } from "../../../lib/chartScale";
import { GROUP_LABELS } from "../../../data/widgetLabels";
import { usePeriod } from "../../../lib/periodFilter";
import type { Widget } from "../../../types";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "2026-11-03" → "3 de nov" (a mano: Intl cambia el formato según el navegador).
function dayLabel(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${day} de ${MONTHS[month - 1]}`;
}

/**
 * Tabla Fecha | valor (o Categoría | valor). Por día se muestran todos los
 * días del período, también los sin ventas (en 0), en orden cronológico; por
 * categoría, el orden del backend (mayor a menor). Con métricas aditivas
 * suma una fila de total fija al pie.
 */
export function WidgetTable({ widget: w }: { widget: Widget }) {
  const [period] = usePeriod();
  const byDay = w.group === "day";
  const additive = isAdditive(w);

  let rows: Array<{ key: string; label: string; value: number | null }>;
  if (byDay) {
    const daily = (w.data ?? []).filter((row) => DAY_KEY.test(row.key)).sort((a, b) => a.key.localeCompare(b.key));
    const range = resolveRange(period.preset, period, daily[0]?.key, daily.at(-1)?.key);
    rows = buildTimeSeries(daily, w, range, "day").map((p) => ({ key: p.key, label: dayLabel(p.key), value: p.value }));
  } else {
    rows = (w.data ?? []).map((row) => ({ key: row.key, label: w.keyLabels?.[row.key] ?? row.key, value: row.value }));
  }

  if (rows.length === 0 || (byDay && rows.every((r) => !r.value))) {
    return <div className="widget-table"><span className="widget-empty">{period.preset === "all" ? "Sin datos para esta agrupación" : "Sin datos en este período"}</span></div>;
  }

  const valueHeader = metricLabel(w, 2).replace(/^./, (c) => c.toUpperCase());
  const total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
  return (
    <div className="widget-table">
      <div className="widget-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{byDay ? "Fecha" : GROUP_LABELS[w.group ?? "port"]}</th>
              <th className="n">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="n">{row.value === null ? "—" : formatWidgetValue(w.field, row.value)}</td>
              </tr>
            ))}
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
