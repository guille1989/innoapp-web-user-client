import { useCallback, useEffect, useState } from "react";
import { api, type ApiMe, type OnboardingAction } from "../api/client";

export function useOnboarding(idToken: string) {
  const [me, setMe] = useState<ApiMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.me(idToken);
      setMe(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const act = useCallback(async (action: OnboardingAction) => {
    const result = await api.updateOnboarding(idToken, action);
    setMe((current) => current ? { ...current, onboarding: result.onboarding } : current);
    return result.onboarding;
  }, [idToken]);

  return { me, loading, error, refresh, act };
}
