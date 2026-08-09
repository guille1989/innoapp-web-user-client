const API_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export interface ApiTicket {
  ticketId: string;
  port: string;
  capturedAt: string;
  status: "pending" | "parsed" | "needs_review" | "failed";
  items?: Array<{ description?: string; quantity?: number; unitPrice?: number; subtotal?: number }>;
  total?: number;
  discount?: number;
  tip?: number;
  failReason?: string;
  parsedBy?: string;
}

export interface ApiAgent {
  agentId: string;
  name: string;
  createdAt: string;
  lastSeenAt?: string;
  version?: string;
  location?: { label?: string; city?: string; lat?: number; lng?: number };
}

export interface AgentLocation {
  label: string;
  city: string;
  lat: number;
  lng: number;
}

export interface ApiActivationCode { code: string; status: "unused" | "used"; createdAt: string; usedAt?: string; agentId?: string }
export interface ApiWidget {
  widgetId: string;
  name: string;
  visualization: "kpi" | "bar" | "donut";
  metric: { field: string; aggregation: "sum" | "avg" | "max" | "min" | "count" };
  groupBy?: string;
  createdAt: string;
}
export type ApiWidgetData = Array<{ label?: string; value: number }>;

async function request<T>(idToken: string, path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("Falta VITE_API_BASE_URL en la configuración del frontend");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 401 || response.status === 403) throw new Error("Tu sesión no tiene acceso a estos datos");
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `La API respondió HTTP ${response.status}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  tickets: (token: string) => request<{ tickets: ApiTicket[] }>(token, "/tickets?limit=100"),
  agents: (token: string) => request<{ agents: ApiAgent[] }>(token, "/agents"),
  updateAgentLocation: (token: string, id: string, location: AgentLocation) =>
    request<{ agentId: string; location: AgentLocation }>(token, `/agents/${encodeURIComponent(id)}/location`, {
      method: "PATCH",
      body: JSON.stringify(location),
    }),
  activationCodes: (token: string) => request<{ codes: ApiActivationCode[] }>(token, "/activation-codes"),
  widgets: (token: string) => request<{ widgets: ApiWidget[] }>(token, "/widgets"),
  widgetData: (token: string, id: string) => request<{ data: ApiWidgetData }>(token, `/widgets/${encodeURIComponent(id)}/data`),
  createWidget: (token: string, body: Omit<ApiWidget, "widgetId" | "createdAt">) =>
    request<ApiWidget>(token, "/widgets", { method: "POST", body: JSON.stringify(body) }),
  deleteWidget: (token: string, id: string) => request<void>(token, `/widgets/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
