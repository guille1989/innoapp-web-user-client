import { useCallback, useEffect, useState } from "react";
import { api, type AgentLocation, type ApiActivationCode, type ApiAgent, type ApiTicket, type ApiWidget, type ApiWidgetData } from "../api/client";

// Cada tick re-ejecuta una query de Athena por widget en el dashboard —
// no es gratis (ver PROYECTO.md sección 10.1: un intervalo agresivo sin
// pausar en pestañas en segundo plano fue lo que disparó el costo de S3
// a principios de agosto). 30s en vez de 15s, y el efecto abajo lo pausa
// del todo mientras la pestaña no está visible.
const POLL_MS = 30_000;

function mergeAgentsKeepingNewest(current: ApiAgent[], incoming: ApiAgent[]): ApiAgent[] {
  const currentById = new Map(current.map((agent) => [agent.agentId, agent]));
  return incoming.map((agent) => {
    const previous = currentById.get(agent.agentId);
    if (!previous?.lastSeenAt || !agent.lastSeenAt) return agent.lastSeenAt ? agent : (previous ?? agent);
    return Date.parse(agent.lastSeenAt) >= Date.parse(previous.lastSeenAt) ? agent : previous;
  });
}

export function useCloudData(idToken: string) {
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [codes, setCodes] = useState<ApiActivationCode[]>([]);
  const [widgets, setWidgets] = useState<ApiWidget[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, ApiWidgetData>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // El onboarding necesita comprobar la conexión sin esperar tickets,
  // códigos, widgets ni consultas de Athena. Esta lectura separada también
  // evita que una respuesta antigua del refresh general tape un heartbeat
  // que acabamos de observar.
  const refreshAgents = useCallback(async () => {
    try {
      const result = await api.agents(idToken);
      setAgents((current) => mergeAgentsKeepingNewest(current, result.agents));
      return result.agents;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [idToken]);

  const refresh = useCallback(async () => {
    try {
      const [ticketResult, agentResult, codeResult, widgetResult] = await Promise.all([
        api.tickets(idToken), api.agents(idToken), api.activationCodes(idToken), api.widgets(idToken),
      ]);
      const dataResults = await Promise.allSettled(widgetResult.widgets.map(async (w) => [w.widgetId, (await api.widgetData(idToken, w.widgetId)).data] as const));
      const dataEntries = dataResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setTickets(ticketResult.tickets);
      setAgents((current) => mergeAgentsKeepingNewest(current, agentResult.agents));
      setCodes(codeResult.codes);
      setWidgets(widgetResult.widgets);
      setWidgetData(Object.fromEntries(dataEntries));
      setError(dataResults.some((result) => result.status === "rejected") ? "No se pudieron actualizar los datos de uno o más widgets" : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [idToken]);

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

  const createWidget = useCallback(async (body: Omit<ApiWidget, "widgetId" | "createdAt">) => {
    try {
      await api.createWidget(idToken, body);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [idToken, refresh]);
  const deleteWidget = useCallback(async (id: string) => {
    try {
      await api.deleteWidget(idToken, id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [idToken, refresh]);

  const updateAgentLocation = useCallback(async (id: string, location: AgentLocation) => {
    try {
      await api.updateAgentLocation(idToken, id, location);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [idToken, refresh]);

  return { tickets, agents, codes, widgets, widgetData, error, loading, refresh, refreshAgents, createWidget, deleteWidget, updateAgentLocation };
}
