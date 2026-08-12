import { useMemo, useState } from "react";
import { TopBar } from "./components/TopBar";
import type { AppView } from "./components/BottomNav";
import { Overlay } from "./components/Overlay";
import { DashboardView } from "./components/dashboard/DashboardView";
import { WidgetBuilderSheet } from "./components/dashboard/WidgetBuilderSheet";
import { RobotsView } from "./components/robots/RobotsView";
import { AiSheet } from "./components/ai/AiSheet";
import { useCloudData } from "./hooks/useCloudData";
import { useAuth } from "./auth/AuthContext";
import type { ApiAgent, ApiTicket, ApiWidget } from "./api/client";
import type { BusinessEvent, Robot, Widget } from "./types";

type ActiveSheet = "ai" | "builder" | null;
const VALID_FIELDS = new Set<Widget["field"]>(["event_count", "quantity", "unitPrice", "subtotal", "discount", "tip", "total"]);
const VALID_GROUPS = new Set<NonNullable<Widget["group"]>>(["port", "status", "parsedBy", "description"]);

function toEvent(ticket: ApiTicket): BusinessEvent {
  const date = new Date(ticket.capturedAt);
  return {
    id: ticket.ticketId,
    ts: date.getTime(),
    timeStr: date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    store: "Datos capturados",
    robot: ticket.port,
    eventType: "venta",
    meta: { label: ticket.status, color: "var(--teal)", bg: "var(--teal-dim)" },
    monto: ticket.total ?? 0,
    items: ticket.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0,
    metodoPago: "Sin dato",
  };
}

function toRobot(agent: ApiAgent): Robot {
  const seen = agent.lastSeenAt ? Date.now() - new Date(agent.lastSeenAt).getTime() : Infinity;
  const status = seen <= 2 * 60_000 ? "online" : seen <= 5 * 60_000 ? "warn" : "offline";
  return {
    id: agent.agentId,
    name: agent.name,
    store: agent.location?.label ?? "Ubicación sin configurar",
    city: agent.location?.city ?? "",
    lat: agent.location?.lat,
    lng: agent.location?.lng,
    status,
    meta: agent.lastSeenAt ? `visto ${new Date(agent.lastSeenAt).toLocaleString("es-ES")}` : "sin heartbeat",
  };
}

export function AuthenticatedApp() {
  const { idToken } = useAuth();
  const [view, setView] = useState<AppView>("dashboard");
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const cloud = useCloudData(idToken!);
  const events = useMemo(() => cloud.tickets.map(toEvent).sort((a, b) => a.ts - b.ts), [cloud.tickets]);
  const robots = useMemo(() => cloud.agents.map(toRobot), [cloud.agents]);
  const widgets = useMemo(() => cloud.widgets.map((w: ApiWidget): Widget => ({
    id: w.widgetId,
    type: w.visualization,
    title: w.name,
    field: VALID_FIELDS.has(w.metric.field as Widget["field"]) ? w.metric.field as Widget["field"] : "event_count",
    agg: w.metric.aggregation,
    group: w.groupBy && VALID_GROUPS.has(w.groupBy as NonNullable<Widget["group"]>) ? w.groupBy as Widget["group"] : null,
    data: cloud.widgetData[w.widgetId]?.map((row) => ({ key: row.label ?? "total", value: row.value })) ?? [],
  })), [cloud.widgets, cloud.widgetData]);
  const latestEventId = events.at(-1)?.id ?? null;

  function addWidget(cfg: Omit<Widget, "id">) {
    void cloud.createWidget({
      name: cfg.title,
      visualization: cfg.type,
      metric: { field: cfg.field, aggregation: cfg.field === "event_count" ? "count" : cfg.agg },
      ...(cfg.group ? { groupBy: cfg.group } : {}),
    });
  }

  return (
    <div className="app-root">
      <TopBar active={view} onChange={setView} />
      <main className="app-stage">
        {(cloud.error || cloud.loading) && (
          <div className={`api-banner glass${cloud.error ? " error" : ""}`}>
            <span className={cloud.loading ? "spinner" : "status-dot"} />
            {cloud.error ?? "Sincronizando datos reales…"}
            {cloud.error && <button onClick={() => void cloud.refresh()}>Reintentar</button>}
          </div>
        )}
        <DashboardView active={view === "dashboard"} widgets={widgets} events={events} onRemoveWidget={(id) => void cloud.deleteWidget(id)} onOpenBuilder={() => setActiveSheet("builder")} />
        <RobotsView active={view === "robots"} events={events} latestEventId={latestEventId} robots={robots} codes={cloud.codes} onUpdateLocation={cloud.updateAgentLocation} />
      </main>
      <Overlay open={activeSheet !== null} onClick={() => setActiveSheet(null)} />
      <AiSheet open={activeSheet === "ai"} onOpen={() => setActiveSheet("ai")} onClose={() => setActiveSheet(null)} events={events} onCreateWidget={addWidget} idToken={idToken!} />
      <WidgetBuilderSheet open={activeSheet === "builder"} onClose={() => setActiveSheet(null)} onCreate={addWidget} />
    </div>
  );
}
