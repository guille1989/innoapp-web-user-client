export interface Session {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

export interface SessionUser {
  email: string;
  tenantId: string;
  sub: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export interface SessionSnapshot {
  status: AuthStatus;
  session: Session | null;
  user: SessionUser | null;
}

export const SESSION_STORAGE_KEY = "innoapp.session";
const REFRESH_MARGIN_MS = 60_000;

/** Display and React identity only; the API verifies the JWT independently. */
export function userFromIdToken(idToken: string): SessionUser {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("La sesión no contiene una identidad válida.");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
  const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  if (!claims || typeof claims.sub !== "string" || !claims.sub ||
      typeof claims["custom:tenantId"] !== "string" || !claims["custom:tenantId"]) {
    throw new Error("La sesión no contiene una identidad válida.");
  }
  return {
    email: typeof claims.email === "string" ? claims.email : "",
    tenantId: claims["custom:tenantId"],
    sub: claims.sub,
  };
}

export function sessionIdentity(user: SessionUser): string {
  return JSON.stringify([user.tenantId, user.sub]);
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const session = value as Session;
  if (typeof session.idToken !== "string" || !session.idToken ||
      typeof session.accessToken !== "string" || !session.accessToken ||
      typeof session.refreshToken !== "string" || !session.refreshToken ||
      typeof session.expiresAt !== "number" || !Number.isFinite(session.expiresAt) || session.expiresAt <= 0) return false;
  try {
    userFromIdToken(session.idToken);
    return true;
  } catch {
    return false;
  }
}

/** Read older installations as well as revisioned records. */
export function sessionFromStorage(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as unknown;
    const candidate = record && typeof record === "object" && "version" in record
      ? (record as { version?: number; session?: unknown }).version === 1
        ? (record as { session?: unknown }).session
        : null
      : record;
    return isSession(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

interface SessionDependencies {
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  login(email: string, password: string): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  onChange(snapshot: SessionSnapshot): void;
  now?: () => number;
  revision?: () => string;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}

/**
 * Owns one mounted provider. Every operation belongs to a generation and the
 * exact persisted revision it started from. Logout writes a token-free revision
 * so a pending login in another tab cannot resurrect a deleted session.
 */
export class SessionCoordinator {
  private readonly dependencies: SessionDependencies;
  private active = false;
  private generation = 0;
  private observedRaw: string | null = null;
  private fallbackRaw: string | null = null;
  private persistenceAvailable = true;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(dependencies: SessionDependencies) {
    this.dependencies = dependencies;
  }

  start(): void {
    this.active = true;
    this.adoptStorage(this.readStorage());
  }

  stop(): void {
    this.active = false;
    this.advance();
  }

  syncStorage(): void {
    if (!this.active) return;
    const raw = this.readStorage();
    if (raw !== this.observedRaw) this.adoptStorage(raw);
  }

  async login(email: string, password: string): Promise<void> {
    if (!this.active) return;
    const generation = this.advance();
    const expectedRaw = this.writeStorage(null);
    this.publish(null, "unauthenticated");
    try {
      const session = await this.dependencies.login(email, password);
      if (!this.isCurrent(generation, expectedRaw)) return;
      if (!isSession(session) || session.expiresAt <= this.now()) throw new Error("Cognito no devolvió una sesión válida.");
      this.accept(session);
    } catch (error) {
      // A previous login cannot report an error against a newer account either.
      if (this.isCurrent(generation, expectedRaw)) throw error;
    }
  }

  logout(): void {
    if (!this.active) return;
    this.advance();
    this.writeStorage(null);
    this.publish(null, "unauthenticated");
  }

  private now(): number {
    return (this.dependencies.now ?? Date.now)();
  }

  private advance(): number {
    this.generation += 1;
    if (this.timer !== null) (this.dependencies.cancel ?? clearTimeout)(this.timer);
    this.timer = null;
    return this.generation;
  }

  private readStorage(): string | null {
    if (!this.persistenceAvailable) return this.fallbackRaw;
    try {
      return this.dependencies.storage.getItem(SESSION_STORAGE_KEY);
    } catch {
      this.persistenceAvailable = false;
      // Storage can be unavailable in private/restricted browsers; stay usable
      // for this tab without letting a storage exception break authentication.
      return this.fallbackRaw;
    }
  }

  private writeStorage(session: Session | null): string {
    const raw = JSON.stringify({
      version: 1,
      revision: (this.dependencies.revision ?? (() => crypto.randomUUID()))(),
      session,
    });
    this.observedRaw = raw;
    this.fallbackRaw = raw;
    try {
      this.dependencies.storage.setItem(SESSION_STORAGE_KEY, raw);
    } catch {
      this.persistenceAvailable = false;
      // The in-memory lifecycle guard still applies when persistence is disabled.
    }
    return raw;
  }

  private publish(session: Session | null, status: AuthStatus): void {
    if (this.active) this.dependencies.onChange({ status, session, user: session ? userFromIdToken(session.idToken) : null });
  }

  private adoptStorage(raw: string | null): void {
    const generation = this.advance();
    this.observedRaw = raw;
    this.fallbackRaw = raw;
    const session = sessionFromStorage(raw);
    if (!session) {
      this.publish(null, "unauthenticated");
    } else if (session.expiresAt <= this.now()) {
      this.publish(null, "loading");
      void this.refresh(session, generation, raw);
    } else {
      this.publish(session, "authenticated");
      this.scheduleRefresh(session, generation, raw);
    }
  }

  private isCurrent(generation: number, expectedRaw: string | null): boolean {
    if (!this.active || this.generation !== generation) return false;
    const currentRaw = this.readStorage();
    if (currentRaw !== expectedRaw) {
      // Also catches another tab's action before its queued storage event runs.
      this.adoptStorage(currentRaw);
      return false;
    }
    return true;
  }

  private accept(session: Session): void {
    const raw = this.writeStorage(session);
    this.publish(session, "authenticated");
    this.scheduleRefresh(session, this.generation, raw);
  }

  private scheduleRefresh(session: Session, generation: number, raw: string | null): void {
    const delay = Math.max(0, session.expiresAt - this.now() - REFRESH_MARGIN_MS);
    this.timer = (this.dependencies.schedule ?? setTimeout)(() => {
      this.timer = null;
      if (this.isCurrent(generation, raw)) void this.refresh(session, generation, raw);
    }, delay);
  }

  private async refresh(session: Session, generation: number, expectedRaw: string | null): Promise<void> {
    try {
      const next = await this.dependencies.refresh(session.refreshToken);
      if (!this.isCurrent(generation, expectedRaw)) return;
      if (!isSession(next) || next.expiresAt <= this.now() ||
          sessionIdentity(userFromIdToken(next.idToken)) !== sessionIdentity(userFromIdToken(session.idToken))) {
        throw new Error("La renovación devolvió una identidad distinta o una sesión inválida.");
      }
      this.accept(next);
    } catch {
      if (this.isCurrent(generation, expectedRaw)) this.logout();
    }
  }
}
