import { useCallback, useEffect, useMemo, useState } from "react";
import { TopBar } from "./components/TopBar";
import type { AppView } from "./components/BottomNav";
import { Overlay } from "./components/Overlay";
import { DashboardView } from "./components/dashboard/DashboardView";
import { WidgetBuilderSheet } from "./components/dashboard/WidgetBuilderSheet";
import { RobotsView } from "./components/robots/RobotsView";
import { useReports } from "./hooks/useReports";
import { AiSheet } from "./components/ai/AiSheet";
import { AiChatView } from "./components/ai/AiChatView";
import { useCloudData } from "./hooks/useCloudData";
import { useOnboarding } from "./hooks/useOnboarding";
import { useAuth } from "./auth/AuthContext";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { OnboardingReminder } from "./components/onboarding/OnboardingReminder";
import { ProductTour } from "./components/onboarding/ProductTour";
import type { ApiAgent, ApiTicket, ApiWidget } from "./api/client";
import type { BusinessEvent, Robot, Widget } from "./types";

type ActiveSheet = "ai" | "builder" | null;
const VALID_FIELDS = new Set<Widget["field"]>(["event_count", "quantity", "unitPrice", "subtotal", "discount", "tip", "tax", "total"]);
const VALID_GROUPS = new Set<NonNullable<Widget["group"]>>(["port", "agent", "status", "parsedBy", "description", "day", "hour"]);

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
    items: ticket.items?.filter((item) => !item.voided).reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0,
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tourRun, setTourRun] = useState(0);
  const cloud = useCloudData(idToken!);
  const onboarding = useOnboarding(idToken!);
  const reports = useReports(idToken!);
  const onboardingAct = onboarding.act;
  const events = useMemo(() => cloud.tickets.filter((ticket) => ticket.status === "parsed" && Number.isFinite(Date.parse(ticket.capturedAt))).map(toEvent).sort((a, b) => a.ts - b.ts), [cloud.tickets]);
  const robots = useMemo(() => cloud.agents.map(toRobot), [cloud.agents]);
  const widgets = useMemo(() => {
    // Al agrupar por agente el backend devuelve el agentId (un UUID) y "(sin dato)" para los tickets sin
    // agentId (api-key compartida legacy): los datos quedan con su clave cruda (los gráficos con rango
    // vuelven a pedirlos) y `keyLabels` traduce la clave al nombre del agente al mostrarla.
    const agentLabels: Record<string, string> = { "(sin dato)": "Sin agente", ...Object.fromEntries(cloud.agents.map((agent) => [agent.agentId, agent.name])) };
    return cloud.widgets.map((w: ApiWidget): Widget => {
      const group = w.groupBy && VALID_GROUPS.has(w.groupBy as NonNullable<Widget["group"]>) ? w.groupBy as Widget["group"] : null;
      return {
        id: w.widgetId,
        type: w.visualization,
        title: w.name,
        field: VALID_FIELDS.has(w.metric.field as Widget["field"]) ? w.metric.field as Widget["field"] : "event_count",
        agg: w.metric.aggregation,
        group,
        keyLabels: group === "agent" ? agentLabels : undefined,
        data: cloud.widgetData[w.widgetId]?.flatMap((row) => row.value === null ? [] : [{ key: row.label ?? "total", value: row.value, sampleCount: row.sampleCount }]) ?? [],
        dataStatus: cloud.widgetStates[w.widgetId]?.status ?? "loading",
        dataError: cloud.widgetStates[w.widgetId]?.error,
        updatedAt: cloud.widgetStates[w.widgetId]?.updatedAt,
        dataLabel: w.filters?.status && w.filters.status !== "parsed"
          ? "estado: " + w.filters.status
          : group === "status" || group === "parsedBy" ? "datos de diagnóstico" : "datos confirmados",
      };
    });
  }, [cloud.widgets, cloud.widgetData, cloud.widgetStates, cloud.agents]);
  const latestEventId = events.at(-1)?.id ?? null;
  const connected = cloud.agents.length > 0;

  useEffect(() => {
    const state = onboarding.me?.onboarding;
    if (state && !state.startedAt && !state.completedAt) setShowOnboarding(true);
  }, [onboarding.me]);

  const startTour = useCallback(() => {
    setView("dashboard");
    setTourRun((run) => run + 1);
  }, []);

  const finishTour = useCallback(() => {
    if (onboarding.me?.onboarding && !onboarding.me.onboarding.productTourCompletedAt) {
      void onboardingAct("complete-product-tour").catch(() => {});
    }
  }, [onboarding.me?.onboarding, onboardingAct]);

  async function addWidget(cfg: Omit<Widget, "id">) {
    await cloud.createWidget({
      name: cfg.title,
      visualization: cfg.type,
      metric: { field: cfg.field, aggregation: cfg.field === "event_count" ? "count" : cfg.agg },
      ...(cfg.group ? { groupBy: cfg.group } : {}),
    });
  }

  if (onboarding.loading) {
    return <div className="app-loading"><img src="/brand/innoapp-mark.png" alt="InnoApp" /><span className="spinner" /></div>;
  }

  const onboardingState = onboarding.me?.onboarding;
  if (showOnboarding && onboarding.me && onboardingState && !onboardingState.completedAt) {
    return <OnboardingFlow
      businessName={onboarding.me.businessName}
      state={onboardingState}
      agents={cloud.agents}
      codes={cloud.codes}
      tickets={cloud.tickets}
      widgets={cloud.widgets}
      onRefresh={cloud.refresh}
      onRefreshAgents={cloud.refreshAgents}
      onAction={onboardingAct}
      onDefer={() => setShowOnboarding(false)}
      onComplete={() => { setShowOnboarding(false); startTour(); }}
    />;
  }

  return (
    <div className="app-root">
      <TopBar active={view} onChange={setView} onOpenGuide={startTour} />
      <main className="app-stage">
        {(cloud.error || cloud.loading) && (
          <div className={`api-banner glass${cloud.error ? " error" : ""}`}>
            <span className={cloud.loading ? "spinner" : "status-dot"} />
            {cloud.error ?? "Sincronizando datos reales…"}
            {cloud.error && <button onClick={() => void cloud.refresh()}>Reintentar</button>}
          </div>
        )}
        <AiChatView active={view === "ai"} onCreateWidget={addWidget} idToken={idToken!} businessName={onboarding.me?.businessName ?? ""} onReportSaved={() => void reports.refresh()} />
        <DashboardView active={view === "dashboard"} widgets={widgets} events={events} onRemoveWidget={(id) => { void cloud.deleteWidget(id).catch(() => {}); }} onOpenBuilder={() => setActiveSheet("builder")} reports={reports.reports} idToken={idToken!} businessName={onboarding.me?.businessName ?? ""} onDeleteReport={reports.remove} hasMoreReports={reports.hasMore} loadingMoreReports={reports.loadingMore} onLoadMoreReports={() => { void reports.loadMore(); }} />
        <RobotsView active={view === "robots"} events={events} latestEventId={latestEventId} robots={robots} codes={cloud.codes} tickets={cloud.reviewTickets} idToken={idToken!} onUpdateLocation={cloud.updateAgentLocation} onReviewTicket={cloud.reviewTicket} />
      </main>
      <footer className="app-footer">Powered by <strong>InnoApp</strong></footer>
      <Overlay open={activeSheet !== null} onClick={() => setActiveSheet(null)} />
      <AiSheet hideDock open={activeSheet === "ai"} onOpen={() => setActiveSheet("ai")} onClose={() => setActiveSheet(null)} onCreateWidget={addWidget} idToken={idToken!} businessName={onboarding.me?.businessName ?? ""} onReportSaved={() => void reports.refresh()} />
      <WidgetBuilderSheet open={activeSheet === "builder"} onClose={() => setActiveSheet(null)} onCreate={addWidget} />
      {onboardingState && !onboardingState.completedAt && (
        <OnboardingReminder connected={connected} hasTickets={cloud.tickets.length > 0} hasWidgets={cloud.widgets.length > 0} onContinue={() => setShowOnboarding(true)} />
      )}
      <ProductTour run={tourRun} onFinished={finishTour} />
    </div>
  );
}
