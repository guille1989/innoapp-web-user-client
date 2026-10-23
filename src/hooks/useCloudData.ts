import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localDateKey } from "../lib/chartScale";
import { periodRange, usePeriod, type PeriodFilter } from "../lib/periodFilter";
import { api, type AgentLocation, type ApiActivationCode, type ApiAgent, type ApiTicket, type ApiWidget } from "../api/client";
import { widgetDataFailure, widgetDataSuccess, type WidgetDataState } from "../lib/widgetDataState";
import { useRequestScope } from "./useRequestScope";

// Cada tick re-ejecuta una query de Athena por widget en el dashboard —
// no es gratis (ver PROYECTO.md sección 10.1: un intervalo agresivo sin
// pausar en pestañas en segundo plano fue lo que disparó el costo de S3
// a principios de agosto). 30s en vez de 15s, y el efecto abajo lo pausa
// del todo mientras la pestaña no está visible.
const POLL_MS = 30_000;

// Un widget por hora solo muestra hoy y ayer: pedir todo el histórico traería
// miles de buckets (y el backend corta en 800, los MÁS VIEJOS).
const HOURLY_RANGE = () => ({ dateFrom: localDateKey(-1), dateTo: localDateKey() });

// Tope defensivo al recorrer la cola de revisión (100 por página): una cola de
// miles de tickets sin revisar es un problema de operación, no de paginación.
const MAX_REVIEW_PAGES = 20;

async function fetchAllNeedsReview(idToken: string, signal: AbortSignal): Promise<ApiTicket[]> {
  const all: ApiTicket[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_REVIEW_PAGES; page++) {
    const result = await api.tickets(idToken, { status: "needs_review", cursor }, signal);
    all.push(...result.tickets);
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  return all;
}

function mergeAgentsKeepingNewest(current: ApiAgent[], incoming: ApiAgent[]): ApiAgent[] {
  const currentById = new Map(current.map((agent) => [agent.agentId, agent]));
  return incoming.map((agent) => {
    const previous = currentById.get(agent.agentId);
    if (!previous?.lastSeenAt || !agent.lastSeenAt) return agent.lastSeenAt ? agent : (previous ?? agent);
    return Date.parse(agent.lastSeenAt) >= Date.parse(previous.lastSeenAt) ? agent : previous;
  });
}

export function useCloudData(idToken: string) {
  const scope = useRequestScope(idToken);
  // `tickets` = los 100 más recientes (feed de actividad). `reviewTickets` = TODA la cola
  // `needs_review`, pedida por estado: filtrar los 100 recientes ocultaba los pendientes viejos.
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [reviewTickets, setReviewTickets] = useState<ApiTicket[]>([]);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [codes, setCodes] = useState<ApiActivationCode[]>([]);
  const [widgets, setWidgets] = useState<ApiWidget[]>([]);
  const [widgetStates, setWidgetStates] = useState<Record<string, WidgetDataState>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Período global de los widgets. Cambiarlo recrea `refresh`, y el efecto de abajo
  // lo dispara de inmediato; `appliedPeriod` distingue ese cambio de un refresco normal.
  const [period] = usePeriod();
  const appliedPeriod = useRef<PeriodFilter | null>(null);

  // El onboarding necesita comprobar la conexión sin esperar tickets,
  // códigos, widgets ni consultas de Athena. Esta lectura separada también
  // evita que una respuesta antigua del refresh general tape un heartbeat
  // que acabamos de observar.
  const refreshAgents = useCallback(async () => {
    const task = scope.start("agents");
    try {
      const result = await api.agents(idToken, task.signal);
      if (!task.isCurrent()) return [];
      setAgents((current) => mergeAgentsKeepingNewest(current, result.agents));
      return result.agents;
    } catch (err) {
      if (task.isCurrent()) setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      task.finish();
    }
  }, [idToken, scope]);

  const refresh = useCallback(async () => {
    const task = scope.start("refresh");
    const agentTask = scope.start("agents");
    try {
      const [ticketResult, reviewResult, agentResult, codeResult, widgetResult] = await Promise.all([
        api.tickets(idToken, {}, task.signal),
        fetchAllNeedsReview(idToken, task.signal),
        api.agents(idToken, AbortSignal.any([task.signal, agentTask.signal])).catch((err) => {
          if (!agentTask.isCurrent()) return null;
          throw err;
        }),
        api.activationCodes(idToken, task.signal), api.widgets(idToken, task.signal),
      ]);
      if (!task.isCurrent()) return;
      setTickets(ticketResult.tickets);
      setReviewTickets(reviewResult);
      if (agentTask.isCurrent() && agentResult) setAgents((current) => mergeAgentsKeepingNewest(current, agentResult.agents));
      agentTask.finish();
      setCodes(codeResult.codes);
      setWidgets(widgetResult.widgets);
      // Con otro período, los datos anteriores corresponden a otro rango: no se muestran mientras llegan los nuevos.
      // Los widgets por hora no dependen del período (siempre hoy y ayer).
      const periodChanged = appliedPeriod.current !== period;
      appliedPeriod.current = period;
      setWidgetStates((previous) => Object.fromEntries(widgetResult.widgets.map((w) => [
        w.widgetId, (periodChanged && w.groupBy !== "hour" ? undefined : previous[w.widgetId]) ?? { data: [], status: "loading" as const },
      ])));
      const range = periodRange(period);
      const periodDates = range ? { dateFrom: range.from, dateTo: range.to } : undefined;
      const dataResults = await Promise.allSettled(widgetResult.widgets.map(async (w) =>
        (await api.widgetData(idToken, w.widgetId, w.groupBy === "hour" ? HOURLY_RANGE() : periodDates, task.signal)).data));
      if (!task.isCurrent()) return;
      setWidgetStates((previous) => Object.fromEntries(widgetResult.widgets.map((w, index) => {
        const result = dataResults[index];
        return [w.widgetId, result.status === "fulfilled"
          ? widgetDataSuccess(result.value)
          : widgetDataFailure(previous[w.widgetId], result.reason instanceof Error ? result.reason.message : "No se pudo consultar este widget")];
      })));
      setError(dataResults.some((result) => result.status === "rejected") ? "No se pudieron actualizar los datos de uno o más widgets" : null);
    } catch (err) {
      if (task.isCurrent()) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setWidgetStates((previous) => Object.fromEntries(Object.entries(previous).map(([id, state]) => [id, widgetDataFailure(state, message)])));
      }
    } finally {
      if (task.isCurrent()) setLoading(false);
      agentTask.finish();
      task.finish();
    }
  }, [idToken, scope, period]);

  const latestRefresh = useRef(refresh);
  useEffect(() => { latestRefresh.current = refresh; }, [refresh]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const mutate = useCallback(async (key: string, action: (signal: AbortSignal) => Promise<unknown>) => {
    const task = scope.start(key);
    try {
      await action(task.signal);
      if (!task.isCurrent()) throw new DOMException("La sesión cambió", "AbortError");
      await latestRefresh.current();
    } catch (err) {
      if (task.isCurrent()) setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      task.finish();
    }
  }, [scope]);

  const createWidget = useCallback((body: Omit<ApiWidget, "widgetId" | "createdAt">) =>
    mutate("create-widget", (signal) => api.createWidget(idToken, body, signal)), [idToken, mutate]);
  const deleteWidget = useCallback((id: string) =>
    mutate("delete-widget:" + id, (signal) => api.deleteWidget(idToken, id, signal)), [idToken, mutate]);

  const updateAgentLocation = useCallback((id: string, location: AgentLocation) =>
    mutate("location:" + id, (signal) => api.updateAgentLocation(idToken, id, location, signal)), [idToken, mutate]);

  const reviewTicket = useCallback((ticketId: string, capturedAt: string, action: "confirm" | "discard") =>
    mutate("review:" + ticketId, (signal) => api.reviewTicket(idToken, ticketId, capturedAt, action, signal)), [idToken, mutate]);

  const widgetData = useMemo(() => Object.fromEntries(Object.entries(widgetStates).map(([id, state]) => [id, state.data])), [widgetStates]);
  return { tickets, reviewTickets, agents, codes, widgets, widgetData, widgetStates, error, loading, refresh, refreshAgents, createWidget, deleteWidget, updateAgentLocation, reviewTicket };
}
