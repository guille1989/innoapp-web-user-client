import { dataFloorKey, RANGE_LABELS, shortRangeLabel, todayKey, type RangePreset } from "../../../lib/chartScale";

export interface RangeView {
  range: RangePreset;
  from?: string;
  to?: string;
}

interface RangePickerProps {
  view: RangeView;
  /** Rango ya resuelto (fechas efectivas), para rotular la opción "Personalizado". */
  resolved: { from: string; to: string };
  editing: boolean;
  onChange: (preset: RangePreset) => void;
  onToggleEdit: () => void;
}

/** Selector de rango de fechas compartido por las gráficas de línea y de barras. */
export function RangePicker({ view, resolved, editing, onChange, onToggleEdit }: RangePickerProps) {
  return (
    <div className="chart-range">
      {/* Con rango personalizado, la opción muestra las fechas elegidas: no hace falta otro rótulo al lado (en un widget de 320px no entra). */}
      <select className="chart-select" value={view.range} onChange={(e) => onChange(e.target.value as RangePreset)} aria-label="Rango de fechas">
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map((preset) => (
          <option key={preset} value={preset}>{preset === "custom" && view.range === "custom" ? shortRangeLabel(resolved.from, resolved.to) : RANGE_LABELS[preset]}</option>
        ))}
      </select>
      {view.range === "custom" && (
        <button type="button" className="chart-range-edit" onClick={onToggleEdit} aria-expanded={editing} aria-label="Editar rango personalizado" title="Editar rango">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="2.5" width="9" height="8" rx="1.5" /><path d="M1.5 5h9M4 1.2v2.4M8 1.2v2.4" /></svg>
        </button>
      )}
    </div>
  );
}

interface RangePanelProps {
  resolved: { from: string; to: string };
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onDone: () => void;
}

export function RangePanel({ resolved, onFrom, onTo, onDone }: RangePanelProps) {
  return (
    <div className="chart-range-panel" role="dialog" aria-label="Rango personalizado" onKeyDown={(e) => { if (e.key === "Escape") onDone(); }}>
      <label>
        <span>Desde</span>
        <input type="date" value={resolved.from} min={dataFloorKey()} max={resolved.to} onChange={(e) => { if (e.target.value) onFrom(e.target.value); }} />
      </label>
      <label>
        <span>Hasta</span>
        <input type="date" value={resolved.to} min={resolved.from} max={todayKey()} onChange={(e) => { if (e.target.value) onTo(e.target.value); }} />
      </label>
      <button type="button" className="chart-range-done" onClick={onDone}>Listo</button>
    </div>
  );
}
