const API_URL = (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export interface ApiTicket {
  ticketId: string;
  port: string;
  capturedAt: string;
  status: "pending" | "parsed" | "needs_review" | "failed" | "discarded";
  items?: Array<{ description?: string; quantity?: number; unitPrice?: number; subtotal?: number; voided?: boolean }>;
  total?: number;
  tax?: number;
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
export interface ApiTicketImage { ticketId: string; width: number; height: number; png: string }
export interface ApiWidget {
  widgetId: string;
  name: string;
  visualization: "kpi" | "bar" | "line" | "donut";
  metric: { field: string; aggregation: "sum" | "avg" | "max" | "min" | "count" };
  groupBy?: string;
  filters?: { dateFrom?: string; dateTo?: string; port?: string; status?: ApiTicket["status"]; descriptionContains?: string };
  createdAt: string;
}
export type ApiWidgetData = Array<{ label?: string; value: number | null; sampleCount?: number }>;
export interface ApiReportSection {
  kind: "kpi" | "trend" | "ranking";
  heading: string;
  field: string;
  aggregation: string;
  groupBy?: string;
  data: ApiWidgetData;
  /** Solo KPIs con rango de fechas: valor del periodo anterior de igual duración. */
  previous?: number | null;
}
export interface ApiReport { title: string; generatedAt: string; sections: ApiReportSection[] }
export interface ApiAssistantAnswer { answer: string; report?: ApiReport; reportId?: string }
export interface ApiReportListItem { reportId: string; title: string; createdAt: string; expiresAt: string }
export interface ApiStoredReport { reportId: string; summary: string; report: ApiReport; createdAt: string; expiresAt: string }
export interface ApiAssistantHistoryTurn { role: "user" | "assistant"; text: string }
export interface ApiOnboardingState {
  version: 1;
  startedAt?: string;
  lastDeferredAt?: string;
  completedAt?: string;
  productTourCompletedAt?: string;
  starterDashboardCreatedAt?: string;
}
export interface ApiMe {
  tenantId: string;
  businessName: string;
  createdAt: string;
  /** null identifica una cuenta anterior al onboarding. */
  onboarding: ApiOnboardingState | null;
}
export type OnboardingAction = "start" | "defer" | "complete" | "complete-product-tour" | "create-starter-dashboard";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readErrorBody(response: Response): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  throw new ApiError(body.error ?? `La API respondió HTTP ${response.status}`, response.status);
}

async function request<T>(idToken: string, path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("Falta VITE_API_BASE_URL en la configuración del frontend");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 401 || response.status === 403) throw new ApiError("Tu sesión no tiene acceso a estos datos", response.status);
  if (!response.ok) return readErrorBody(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Sin token — a diferencia de `request()`, esto es para el único endpoint público: `POST /signup` (la persona todavía no tiene ninguna credencial). */
async function requestPublic<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("Falta VITE_API_BASE_URL en la configuración del frontend");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) return readErrorBody(response);
  return (await response.json()) as T;
}

/** Zona IANA del navegador ("America/Bogota"): el backend agrupa por día/hora local con ella. */
function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const api = {
  signup: (businessName: string, email: string, password: string) =>
    requestPublic<{ tenantId: string }>("/signup", { method: "POST", body: JSON.stringify({ businessName, email, password }) }),
  me: (token: string, signal?: AbortSignal) => request<ApiMe>(token, "/me", { signal }),
  updateOnboarding: (token: string, action: OnboardingAction, signal?: AbortSignal) =>
    request<{ onboarding: ApiOnboardingState }>(token, "/me/onboarding", { method: "PATCH", body: JSON.stringify({ action }), signal }),
  /** Una página de tickets; `nextCursor` viene solo si hay más. Con `status` consulta el índice por estado. */
  tickets: (token: string, opts: { status?: ApiTicket["status"]; cursor?: string } = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams({ limit: "100" });
    if (opts.status) query.set("status", opts.status);
    if (opts.cursor) query.set("cursor", opts.cursor);
    return request<{ tickets: ApiTicket[]; nextCursor?: string }>(token, `/tickets?${query}`, { signal });
  },
  /**
   * Confirmar o descartar un ticket `needs_review` — la única forma en que
   * sale de ese estado. `capturedAt` se manda porque ya lo tiene el
   * dashboard (viene con cada ticket) y el backend lo necesita para ubicar
   * el registro en DynamoDB.
   */
  reviewTicket: (token: string, ticketId: string, capturedAt: string, action: "confirm" | "discard", signal?: AbortSignal) =>
    request<{ ticketId: string; status: ApiTicket["status"] }>(token, `/tickets/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      body: JSON.stringify({ action, capturedAt }),
      signal,
    }),
  /**
   * Reconstruye la imagen del ticket-imagen (Loggro y similares imprimen la
   * factura entera como bitmap) para comparar contra lo que extrajo Bedrock
   * antes de confirmar/descartar. 404 si el ticket se capturó como texto —
   * no hay nada que reconstruir en ese caso.
   */
  ticketImage: (token: string, ticketId: string, capturedAt: string, signal?: AbortSignal) =>
    request<ApiTicketImage>(token, `/tickets/${encodeURIComponent(ticketId)}/image?capturedAt=${encodeURIComponent(capturedAt)}`, { signal }),
  agents: (token: string, signal?: AbortSignal) => request<{ agents: ApiAgent[] }>(token, "/agents", { signal }),
  updateAgentLocation: (token: string, id: string, location: AgentLocation, signal?: AbortSignal) =>
    request<{ agentId: string; location: AgentLocation }>(token, `/agents/${encodeURIComponent(id)}/location`, {
      method: "PATCH",
      body: JSON.stringify(location),
      signal,
    }),
  activationCodes: (token: string, signal?: AbortSignal) => request<{ codes: ApiActivationCode[] }>(token, "/activation-codes", { signal }),
  widgets: (token: string, signal?: AbortSignal) => request<{ widgets: ApiWidget[] }>(token, "/widgets", { signal }),
  /** `range` filtra por fechas inclusivas; sin él se aplica la ventana predeterminada del servidor. */
  widgetData: (token: string, id: string, range?: { dateFrom: string; dateTo: string }, signal?: AbortSignal) =>
    request<{ data: ApiWidgetData }>(
      token,
      `/widgets/${encodeURIComponent(id)}/data?${range ? `dateFrom=${range.dateFrom}&dateTo=${range.dateTo}&` : ""}tz=${encodeURIComponent(browserTimeZone())}`,
      { signal },
    ),
  createWidget: (token: string, body: Omit<ApiWidget, "widgetId" | "createdAt">, signal?: AbortSignal) =>
    request<ApiWidget>(token, "/widgets", { method: "POST", body: JSON.stringify(body), signal }),
  deleteWidget: (token: string, id: string, signal?: AbortSignal) => request<void>(token, `/widgets/${encodeURIComponent(id)}`, { method: "DELETE", signal }),
  reports: (token: string, cursor?: string, signal?: AbortSignal) =>
    request<{ reports: ApiReportListItem[]; nextCursor?: string }>(token, `/reports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }),
  report: (token: string, reportId: string, signal?: AbortSignal) => request<ApiStoredReport>(token, `/reports/${encodeURIComponent(reportId)}`, { signal }),
  deleteReport: (token: string, reportId: string, signal?: AbortSignal) => request<void>(token, `/reports/${encodeURIComponent(reportId)}`, { method: "DELETE", signal }),
  assistantAsk: (token: string, question: string, history: ApiAssistantHistoryTurn[] = [], signal?: AbortSignal) =>
    request<ApiAssistantAnswer>(token, "/assistant/ask", { method: "POST", body: JSON.stringify({ question, history, timeZone: browserTimeZone() }), signal }),
};
