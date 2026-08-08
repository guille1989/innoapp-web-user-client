import { useCallback, useEffect, useState } from "react";
import { api, type ApiActivationCode, type ApiAgent, type ApiTicket, type ApiWidget, type ApiWidgetData } from "../api/client";

const POLL_MS = 15_000;

export function useCloudData(idToken: string) {
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [codes, setCodes] = useState<ApiActivationCode[]>([]);
  const [widgets, setWidgets] = useState<ApiWidget[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, ApiWidgetData>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [ticketResult, agentResult, codeResult, widgetResult] = await Promise.all([
        api.tickets(idToken), api.agents(idToken), api.activationCodes(idToken), api.widgets(idToken),
      ]);
      const dataResults = await Promise.allSettled(widgetResult.widgets.map(async (w) => [w.widgetId, (await api.widgetData(idToken, w.widgetId)).data] as const));
      const dataEntries = dataResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setTickets(ticketResult.tickets);
      setAgents(agentResult.agents);
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
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
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

  return { tickets, agents, codes, widgets, widgetData, error, loading, refresh, createWidget, deleteWidget };
}
