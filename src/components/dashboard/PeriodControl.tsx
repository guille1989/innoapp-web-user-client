import { useEffect, useRef, useState } from "react";
import { dataFloorKey, RANGE_LABELS, todayKey, type RangePreset } from "../../lib/chartScale";
import { periodLabel, periodRange, usePeriod } from "../../lib/periodFilter";

const PRESETS: Array<{ preset: Exclude<RangePreset, "custom">; short: string }> = [
  { preset: "today", short: "Hoy" },
  { preset: "7d", short: "7d" },
  { preset: "30d", short: "30d" },
  { preset: "90d", short: "90d" },
  { preset: "all", short: "Todo" },
];

interface PeriodControlProps {
  /** `header`: píldora flotante de la cabecera. `popover`: fila dentro del menú del usuario (móvil). */
  variant: "header" | "popover";
}

/** Selector "Período Hoy 7d 30d 90d Todo": filtra el tiempo de todos los widgets a la vez. */
export function PeriodControl({ variant }: PeriodControlProps) {
  const [period, setPeriod] = usePeriod();
  const [editing, setEditing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const resolved = periodRange(period) ?? { from: dataFloorKey(), to: todayKey() };
  const custom = period.preset === "custom";

  useEffect(() => {
    if (!editing) return;
    function close(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setEditing(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [editing]);

  function choose(preset: Exclude<RangePreset, "custom">) {
    setPeriod({ preset });
    setEditing(false);
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
          <button key={preset} type="button" className={period.preset === preset ? "active" : ""} aria-pressed={period.preset === preset} aria-label={RANGE_LABELS[preset]} title={RANGE_LABELS[preset]} onClick={() => choose(preset)}>
            {short}
          </button>
        ))}
        <button type="button" className={`period-custom${custom ? " active" : ""}`} aria-pressed={custom} aria-expanded={editing} aria-label="Período personalizado" title={custom ? periodLabel(period) : "Personalizado"} onClick={toggleCustom}>
          {custom ? periodLabel(period) : (
            <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="2.5" width="9" height="8" rx="1.5" /><path d="M1.5 5h9M4 1.2v2.4M8 1.2v2.4" /></svg>
          )}
        </button>
      </div>
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
