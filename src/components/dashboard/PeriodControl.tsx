import { useEffect, useRef, useState } from "react";
import { dataFloorKey, isCalendarUnit, RANGE_LABELS, shiftMonths, todayKey, UNIT_MONTHS, unitStartMonth, type CalendarUnit, type RangePreset } from "../../lib/chartScale";
import { periodLabel, periodRange, unitShortLabel, usePeriod } from "../../lib/periodFilter";

const UNIT_NAMES: Record<CalendarUnit, string> = { month: "Mes", quarter: "Trimestre", semester: "Semestre" };

const PRESETS: Array<{ preset: Exclude<RangePreset, "custom">; short: string }> = [
  { preset: "today", short: "Hoy" },
  { preset: "week", short: "Semana" },
  { preset: "month", short: "Mes" },
  { preset: "quarter", short: "Trim." },
  { preset: "semester", short: "Semest." },
  { preset: "all", short: "Todo" },
];

interface PeriodControlProps {
  /** `header`: píldora flotante de la cabecera. `popover`: fila dentro del menú del usuario (móvil). */
  variant: "header" | "popover";
}

/** Selector "Período Hoy Semana Mes Trim. Semest. Todo": filtra el tiempo de todos los widgets a la vez. */
export function PeriodControl({ variant }: PeriodControlProps) {
  const [period, setPeriod] = usePeriod();
  const [editing, setEditing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const resolved = periodRange(period) ?? { from: dataFloorKey(), to: todayKey() };
  const custom = period.preset === "custom";
  const unit = isCalendarUnit(period.preset) ? period.preset : null;
  const thisMonth = todayKey().slice(0, 7);
  const floorMonth = dataFloorKey().slice(0, 7);
  // Periodo elegido (primer mes) y el en curso, ambos alineados al inicio del mes/trimestre/semestre.
  const currentAnchor = unit ? unitStartMonth(unit, thisMonth) : thisMonth;
  const floorAnchor = unit ? unitStartMonth(unit, floorMonth) : floorMonth;
  const anchor = unit && period.anchor && period.anchor < currentAnchor ? unitStartMonth(unit, period.anchor) : currentAnchor;

  useEffect(() => {
    if (!editing) return;
    function close(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setEditing(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [editing]);

  function choose(preset: Exclude<RangePreset, "custom">) {
    if (isCalendarUnit(preset)) {
      // Primer clic: periodo en curso y se abre el selector; los siguientes lo abren/cierran.
      if (unit !== preset) setPeriod({ preset });
      setEditing((open) => (unit === preset ? !open : true));
      return;
    }
    setPeriod({ preset });
    setEditing(false);
  }

  function chooseAnchor(value: string) {
    if (!unit || !/^\d{4}-\d{2}$/.test(value)) return;
    const aligned = unitStartMonth(unit, value);
    const clamped = aligned < floorAnchor ? floorAnchor : aligned;
    // El periodo en curso se guarda sin `anchor`: así sigue a "hoy" si la pestaña cruza el cambio de mes.
    setPeriod(clamped >= currentAnchor ? { preset: unit } : { preset: unit, anchor: clamped });
  }

  function toggleCustom() {
    if (!custom) setPeriod({ preset: "custom", from: resolved.from, to: resolved.to });
    setEditing((open) => (custom ? !open : true));
  }

  return (
    <div className={`period-wrap in-${variant}`} ref={wrapRef} onPointerDown={(e) => e.stopPropagation()}>
      <div className={`period-control${variant === "header" ? " glass" : ""}`} role="group" aria-label="Período de los widgets">
        <span>Período</span>
        {PRESETS.map(({ preset, short }) => (
          <button key={preset} type="button" className={period.preset === preset ? "active" : ""} aria-pressed={period.preset === preset} aria-label={RANGE_LABELS[preset]} title={unit === preset ? periodLabel({ ...period, anchor }) : RANGE_LABELS[preset]} aria-expanded={isCalendarUnit(preset) ? editing && unit === preset : undefined} onClick={() => choose(preset)}>
            {unit === preset && anchor !== currentAnchor ? unitShortLabel(unit, anchor) : short}
          </button>
        ))}
        <button type="button" className={`period-custom${custom ? " active" : ""}`} aria-pressed={custom} aria-expanded={editing} aria-label="Período personalizado" title={custom ? periodLabel(period) : "Personalizado"} onClick={toggleCustom}>
          {custom ? periodLabel(period) : (
            <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="2.5" width="9" height="8" rx="1.5" /><path d="M1.5 5h9M4 1.2v2.4M8 1.2v2.4" /></svg>
          )}
        </button>
      </div>
      {editing && unit && (
        <div className={`period-panel${variant === "header" ? " glass" : ""}`} role="dialog" aria-label={`Elegir ${UNIT_NAMES[unit]}`} onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}>
          <button type="button" className="period-step" aria-label={`${UNIT_NAMES[unit]} anterior`} disabled={anchor <= floorAnchor} onClick={() => chooseAnchor(shiftMonths(anchor, -UNIT_MONTHS[unit]))}>‹</button>
          {unit === "month" ? (
            <label>
              <span>Mes</span>
              <input type="month" value={anchor} min={floorMonth} max={thisMonth} onChange={(e) => chooseAnchor(e.target.value)} />
            </label>
          ) : (
            <>
              <label>
                <span>{unit === "quarter" ? "Trimestre" : "Semestre"}</span>
                <select value={Math.floor((Number(anchor.slice(5, 7)) - 1) / UNIT_MONTHS[unit]) + 1} onChange={(e) => chooseAnchor(`${anchor.slice(0, 4)}-${String((Number(e.target.value) - 1) * UNIT_MONTHS[unit] + 1).padStart(2, "0")}`)}>
                  {Array.from({ length: 12 / UNIT_MONTHS[unit] }, (_, i) => i + 1).map((n) => {
                    const start = `${anchor.slice(0, 4)}-${String((n - 1) * UNIT_MONTHS[unit] + 1).padStart(2, "0")}`;
                    return <option key={n} value={n} disabled={start < floorAnchor || start > currentAnchor}>{unit === "quarter" ? `T${n}` : `S${n}`}</option>;
                  })}
                </select>
              </label>
              <label>
                <span>Año</span>
                <select value={anchor.slice(0, 4)} onChange={(e) => chooseAnchor(`${e.target.value}${anchor.slice(4)}`)}>
                  {Array.from({ length: Number(currentAnchor.slice(0, 4)) - Number(floorAnchor.slice(0, 4)) + 1 }, (_, i) => Number(floorAnchor.slice(0, 4)) + i).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button type="button" className="period-step" aria-label={`${UNIT_NAMES[unit]} siguiente`} disabled={anchor >= currentAnchor} onClick={() => chooseAnchor(shiftMonths(anchor, UNIT_MONTHS[unit]))}>›</button>
          <button type="button" className="period-done" onClick={() => setEditing(false)}>Listo</button>
        </div>
      )}
      {editing && custom && (
        <div className={`period-panel${variant === "header" ? " glass" : ""}`} role="dialog" aria-label="Período personalizado" onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}>
          <label>
            <span>Desde</span>
            <input type="date" value={resolved.from} min={dataFloorKey()} max={resolved.to} onChange={(e) => { if (e.target.value) setPeriod({ preset: "custom", from: e.target.value, to: resolved.to }); }} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={resolved.to} min={resolved.from} max={todayKey()} onChange={(e) => { if (e.target.value) setPeriod({ preset: "custom", from: resolved.from, to: e.target.value }); }} />
          </label>
          <button type="button" className="period-done" onClick={() => setEditing(false)}>Listo</button>
        </div>
      )}
    </div>
  );
}
