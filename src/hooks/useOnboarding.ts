import { useCallback, useEffect, useState } from "react";
import { api, type ApiMe, type OnboardingAction } from "../api/client";
import { useRequestScope } from "./useRequestScope";

export function useOnboarding(idToken: string) {
  const scope = useRequestScope(idToken);
  const [me, setMe] = useState<ApiMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const task = scope.start("profile");
    try {
      const result = await api.me(idToken, task.signal);
      if (!task.isCurrent()) return;
      setMe(result);
      setError(null);
    } catch (err) {
      if (task.isCurrent()) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (task.isCurrent()) setLoading(false);
      task.finish();
    }
  }, [idToken, scope]);

  useEffect(() => { void refresh(); }, [refresh]);

  const act = useCallback(async (action: OnboardingAction) => {
    scope.cancel("profile");
    const task = scope.start("action");
    try {
      const result = await api.updateOnboarding(idToken, action, task.signal);
      if (!task.isCurrent()) throw new DOMException("La sesión cambió", "AbortError");
      scope.cancel("profile");
      setMe((current) => current ? { ...current, onboarding: result.onboarding } : current);
      return result.onboarding;
    } finally {
      task.finish();
    }
  }, [idToken, scope]);

  return { me, loading, error, refresh, act };
}
