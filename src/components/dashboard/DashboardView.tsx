import { WidgetCard } from "./WidgetCard";
import { IconPlus } from "../icons";
import type { BusinessEvent, Widget } from "../../types";

interface DashboardViewProps {
  active: boolean;
  widgets: Widget[];
  events: BusinessEvent[];
  onRemoveWidget: (id: string) => void;
  onOpenBuilder: () => void;
}

export function DashboardView({ active, widgets, events, onRemoveWidget, onOpenBuilder }: DashboardViewProps) {
  return (
    <div className={`view${active ? " active" : ""}`}>
      <div className="page-title">Tu dashboard</div>
      <div className="page-sub">Construye tus propios KPIs y gráficas a partir de cualquier dato que capturen tus robots</div>
      <div className="canvas">
        {widgets.map((w) => (
          <WidgetCard key={w.id} widget={w} events={events} onRemove={onRemoveWidget} />
        ))}
      </div>
      {active && (
        <button className="fab" onClick={onOpenBuilder} aria-label="Agregar widget">
          <IconPlus />
        </button>
      )}
    </div>
  );
}
