import { useState } from "react";
import { AGG_LABELS, FIELD_LABELS, GROUP_LABELS } from "../../data/widgetLabels";
import { IconBar, IconDonut, IconKpi } from "../icons";
import type { Aggregation, AggregatableField, GroupField, Widget, WidgetType } from "../../types";

interface WidgetBuilderSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (cfg: Omit<Widget, "id">) => void;
}

const TYPE_OPTIONS: Array<{ type: WidgetType; label: string; icon: () => React.ReactElement }> = [
  { type: "kpi", label: "KPI", icon: IconKpi },
  { type: "bar", label: "Barras", icon: IconBar },
  { type: "donut", label: "Dona", icon: IconDonut },
];

const FIELD_OPTIONS: AggregatableField[] = ["count", "monto", "items", "monto_inicial"];
const AGG_OPTIONS: Aggregation[] = ["sum", "avg", "max", "min"];
const GROUP_OPTIONS: GroupField[] = ["store", "robot", "event_type", "metodo_pago"];

export function WidgetBuilderSheet({ open, onClose, onCreate }: WidgetBuilderSheetProps) {
  const [type, setType] = useState<WidgetType>("kpi");
  const [title, setTitle] = useState("");
  const [field, setField] = useState<AggregatableField>("count");
  const [agg, setAgg] = useState<Aggregation>("sum");
  const [group, setGroup] = useState<GroupField>("store");

  function reset() {
    setType("kpi");
    setTitle("");
    setField("count");
    setAgg("sum");
    setGroup("store");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleCreate() {
    const groupVal = type === "kpi" ? null : group;
    const autoTitle =
      FIELD_LABELS[field] +
      (agg && field !== "count" ? ` (${AGG_LABELS[agg].toLowerCase()})` : "") +
      (groupVal ? ` por ${GROUP_LABELS[groupVal].toLowerCase()}` : "");
    onCreate({ type, title: title.trim() || autoTitle, field, agg, group: groupVal });
    handleClose();
  }

  return (
    <div className={`sheet builder-sheet${open ? " open" : ""}`} id="dpBuilderSheet">
      <div className="sheet-handle" />
      <div className="builder-head">
        <div className="modal-title">Nuevo widget</div>
        <div className="modal-sub">Elige qué medir a partir de tus datos.</div>
      </div>
      <div className="builder-body">
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

        {field !== "count" && (
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

        {type !== "kpi" && (
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

        <button className="btn-primary" onClick={handleCreate}>
          Crear widget
        </button>
      </div>
    </div>
  );
}
