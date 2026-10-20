import { useState } from "react";
import { AGG_LABELS, FIELD_LABELS, GROUP_LABELS } from "../../data/widgetLabels";
import { IconBar, IconDonut, IconKpi, IconLine } from "../icons";
import type { Aggregation, AggregatableField, GroupField, Widget, WidgetType } from "../../types";

interface WidgetBuilderSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (cfg: Omit<Widget, "id">) => Promise<void>;
}

const TYPE_OPTIONS: Array<{ type: WidgetType; label: string; icon: () => React.ReactElement }> = [
  { type: "kpi", label: "KPI", icon: IconKpi },
  { type: "bar", label: "Barras", icon: IconBar },
  { type: "line", label: "Línea", icon: IconLine },
  { type: "donut", label: "Dona", icon: IconDonut },
];

const FIELD_OPTIONS: AggregatableField[] = ["event_count", "total", "quantity", "unitPrice", "subtotal", "discount", "tip", "tax"];
const AGG_OPTIONS: Aggregation[] = ["sum", "avg", "max", "min", "count"];
const GROUP_OPTIONS: GroupField[] = ["port", "agent", "status", "parsedBy", "description"];

export function WidgetBuilderSheet({ open, onClose, onCreate }: WidgetBuilderSheetProps) {
  const [type, setType] = useState<WidgetType>("kpi");
  const [title, setTitle] = useState("");
  const [field, setField] = useState<AggregatableField>("event_count");
  const [agg, setAgg] = useState<Aggregation>("sum");
  const [group, setGroup] = useState<GroupField>("agent");
  const [timeAxis, setTimeAxis] = useState<"day" | "hour">("day");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType("kpi");
    setTitle("");
    setField("event_count");
    setAgg("sum");
    setGroup("agent");
    setTimeAxis("day");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreate() {
    if (saving) return;
    const groupVal = type === "kpi" ? null : type === "line" ? timeAxis : group;
    const autoTitle =
      FIELD_LABELS[field] +
      (agg && field !== "event_count" ? ` (${AGG_LABELS[agg].toLowerCase()})` : "") +
      (groupVal ? ` por ${GROUP_LABELS[groupVal].toLowerCase()}` : "");
    setSaving(true);
    setError(null);
    try {
      await onCreate({ type, title: title.trim() || autoTitle, field, agg, group: groupVal });
      handleClose();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : "No se pudo crear el widget");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`sheet builder-sheet${open ? " open" : ""}`} id="dpBuilderSheet">
      <div className="sheet-handle" />
      <div className="builder-head">
        <div className="modal-title">Nuevo widget</div>
        <div className="modal-sub">Elige qué medir a partir de tus datos.</div>
      </div>
      <div className="builder-body">
        {error && <div role="alert">{error}</div>}
        <div className="field">
          <label className="field-label">Tipo de visualización</label>
          <div className="type-options">
            {TYPE_OPTIONS.map(({ type: t, label, icon: Icon }) => (
              <button
                key={t}
                type="button"
                className={`type-opt${type === t ? " selected" : ""}`}
                onClick={() => setType(t)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="wTitle">
            Título del widget
          </label>
          <input
            id="wTitle"
            type="text"
            className="text-input"
            placeholder="Ej. Ventas por método de pago"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="wField">
            Campo a medir
          </label>
          <select
            id="wField"
            className="select"
            value={field}
            onChange={(e) => setField(e.target.value as AggregatableField)}
          >
            {FIELD_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {FIELD_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        {field !== "event_count" && (
          <div className="field">
            <label className="field-label" htmlFor="wAgg">
              Agregación
            </label>
            <select id="wAgg" className="select" value={agg} onChange={(e) => setAgg(e.target.value as Aggregation)}>
              {AGG_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {AGG_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === "line" && (
          <div className="field">
            <label className="field-label">Eje X</label>
            <div className="chart-segmented" role="group" aria-label="Eje X temporal">
              <button type="button" className={timeAxis === "day" ? "active" : ""} aria-pressed={timeAxis === "day"} onClick={() => setTimeAxis("day")}>Por día</button>
              <button type="button" className={timeAxis === "hour" ? "active" : ""} aria-pressed={timeAxis === "hour"} onClick={() => setTimeAxis("hour")}>Por hora</button>
            </div>
            <div className="temporal-hint" style={{ marginTop: 8, gridTemplateColumns: "1fr" }}>
              <small>
                {timeAxis === "day"
                  ? "Dentro del widget podrás elegir el rango de fechas y agrupar por día, semana o mes."
                  : "Muestra hoy y ayer hora por hora, en la zona horaria de tu navegador."}
              </small>
            </div>
          </div>
        )}

        {type !== "kpi" && type !== "line" && (
          <div className="field">
            <label className="field-label" htmlFor="wGroup">
              Agrupar por
            </label>
            <select
              id="wGroup"
              className="select"
              value={group}
              onChange={(e) => setGroup(e.target.value as GroupField)}
            >
              {GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
        )}

        <button className="btn-primary" onClick={() => void handleCreate()} disabled={saving}>
          {saving ? "Creando…" : "Crear widget"}
        </button>
      </div>
    </div>
  );
}
