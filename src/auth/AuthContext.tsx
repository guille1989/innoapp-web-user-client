import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { login as cognitoLogin, refreshSession } from "./cognito";
import { SESSION_STORAGE_KEY, SessionCoordinator, sessionIdentity } from "./session";
import type { AuthStatus, SessionSnapshot, SessionUser } from "./session";

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  idToken: string | null;
  /** Stable across token renewal; changes whenever tenant or Cognito user changes. */
  sessionKey: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({ status: "loading", session: null, user: null });
  const coordinator = useRef<SessionCoordinator | null>(null);

  useEffect(() => {
    // One owner per effect lifetime: StrictMode's discarded mount must never
    // publish the result of a request into the replacement provider.
    const owner = new SessionCoordinator({
      storage: {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      },
      login: cognitoLogin,
      refresh: refreshSession,
      onChange: setSnapshot,
    });
    coordinator.current = owner;
    const sync = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY || event.key === null) owner.syncStorage();
    };
    const syncOnFocus = () => owner.syncStorage();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", syncOnFocus);
    owner.start();
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", syncOnFocus);
      owner.stop();
      if (coordinator.current === owner) coordinator.current = null;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await coordinator.current?.login(email, password);
  }, []);
  const logout = useCallback(() => coordinator.current?.logout(), []);

  return (
    <AuthContext.Provider value={{
      status: snapshot.status,
      user: snapshot.user,
      idToken: snapshot.session?.idToken ?? null,
      sessionKey: snapshot.user ? sessionIdentity(snapshot.user) : null,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
