import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { login as cognitoLogin, refreshSession, userFromIdToken } from "./cognito";
import type { Session, SessionUser } from "./cognito";

const STORAGE_KEY = "innoapp.session";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  idToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// Refresca un poco antes de que expire (los ID token de Cognito duran 1h
// por default) — así una pestaña que quedó abierta no se corta a mitad de
// sesión esperando a que el usuario haga algo que dispare un 401.
const REFRESH_MARGIN_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((s: Session) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = Math.max(0, s.expiresAt - Date.now() - REFRESH_MARGIN_MS);
    refreshTimer.current = setTimeout(async () => {
      try {
        const next = await refreshSession(s.refreshToken);
        saveSession(next);
        setSession(next);
        scheduleRefresh(next);
      } catch {
        // El refresh token también expiró (o se revocó) — no queda otra
        // que mandar de nuevo al login.
        clearSession();
        setSession(null);
        setStatus("unauthenticated");
      }
    }, delay);
  }, []);

  useEffect(() => {
    const existing = loadSession();
    if (!existing) {
      setStatus("unauthenticated");
      return;
    }
    if (existing.expiresAt <= Date.now()) {
      // El ID token expiró mientras la pestaña estaba cerrada — el
      // refresh token dura mucho más (30 días por default), vale la pena
      // intentarlo antes de mandar al login de una.
      refreshSession(existing.refreshToken)
        .then((next) => {
          saveSession(next);
          setSession(next);
          setStatus("authenticated");
          scheduleRefresh(next);
        })
        .catch(() => {
          clearSession();
          setStatus("unauthenticated");
        });
      return;
    }
    setSession(existing);
    setStatus("authenticated");
    scheduleRefresh(existing);
  }, [scheduleRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const s = await cognitoLogin(email, password);
      saveSession(s);
      setSession(s);
      setStatus("authenticated");
      scheduleRefresh(s);
    },
    [scheduleRefresh],
  );

  const logout = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    clearSession();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const user = session ? userFromIdToken(session.idToken) : null;

  return (
    <AuthContext.Provider value={{ status, user, idToken: session?.idToken ?? null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
