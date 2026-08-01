import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { BottomNav, type AppView } from "./components/BottomNav";
import { Overlay } from "./components/Overlay";
import { DashboardView } from "./components/dashboard/DashboardView";
import { WidgetBuilderSheet } from "./components/dashboard/WidgetBuilderSheet";
import { RobotsView } from "./components/robots/RobotsView";
import { AiSheet } from "./components/ai/AiSheet";
import { useEventStream } from "./hooks/useEventStream";
import type { Widget } from "./types";

type ActiveSheet = "ai" | "builder" | null;

const INITIAL_WIDGETS: Widget[] = [
  { id: "w1", type: "kpi", title: "Ventas totales", field: "monto", agg: "sum", group: null },
  { id: "w2", type: "kpi", title: "Tickets capturados", field: "count", agg: "sum", group: null },
  { id: "w3", type: "bar", title: "Ventas por sucursal", field: "monto", agg: "sum", group: "store" },
  { id: "w4", type: "donut", title: "Eventos por tipo", field: "count", agg: "sum", group: "event_type" },
];

let widgetSeq = 5;

export function AuthenticatedApp() {
  const [view, setView] = useState<AppView>("dashboard");
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [widgets, setWidgets] = useState<Widget[]>(INITIAL_WIDGETS);
  const { events, latestEventId } = useEventStream();

  function addWidget(cfg: Omit<Widget, "id">) {
    setWidgets((prev) => [...prev, { ...cfg, id: `w${widgetSeq++}` }]);
  }

  function removeWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div className="app-root">
      <TopBar onOpenAi={() => setActiveSheet("ai")} />

      <div className="content">
        <DashboardView
          active={view === "dashboard"}
          widgets={widgets}
          events={events}
          onRemoveWidget={removeWidget}
          onOpenBuilder={() => setActiveSheet("builder")}
        />
        <RobotsView active={view === "robots"} events={events} latestEventId={latestEventId} />
      </div>

      <BottomNav active={view} onChange={setView} />

      <Overlay open={activeSheet !== null} onClick={() => setActiveSheet(null)} />
      <AiSheet
        open={activeSheet === "ai"}
        onClose={() => setActiveSheet(null)}
        events={events}
        onCreateWidget={addWidget}
      />
      <WidgetBuilderSheet open={activeSheet === "builder"} onClose={() => setActiveSheet(null)} onCreate={addWidget} />
    </div>
  );
}
