import type { ApiWidgetData } from "../api/client";

export interface WidgetDataState {
  data: ApiWidgetData;
  /** Datos de `secondaryMetric` (KPI con segunda cifra). */
  secondaryData?: ApiWidgetData;
  status: "loading" | "ready" | "error" | "stale";
  error?: string;
  updatedAt?: string;
}

/** Un error conserva únicamente la última respuesta válida del mismo widget. */
export function widgetDataSuccess(data: ApiWidgetData, now = new Date().toISOString(), secondaryData?: ApiWidgetData): WidgetDataState {
  return { data, ...(secondaryData ? { secondaryData } : {}), status: "ready", updatedAt: now };
}

export function widgetDataFailure(previous: WidgetDataState | undefined, error: string): WidgetDataState {
  return {
    data: previous?.data ?? [],
    ...(previous?.secondaryData ? { secondaryData: previous.secondaryData } : {}),
    status: previous?.updatedAt ? "stale" : "error",
    updatedAt: previous?.updatedAt,
    error,
  };
}
