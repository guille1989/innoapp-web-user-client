import assert from "node:assert/strict";
import test from "node:test";
import { SessionCoordinator, SESSION_STORAGE_KEY, sessionFromStorage, sessionIdentity, userFromIdToken } from "../src/auth/session.ts";

const NOW = 1_700_000_000_000;
let revision = 0;
function session(sub = "user-a", tenantId = "tenant-a", expiresAt = NOW + 3_600_000, email = `${sub}@example.com`) {
  const payload = Buffer.from(JSON.stringify({ sub, "custom:tenantId": tenantId, email })).toString("base64url");
  return { idToken: `header.${payload}.signature`, accessToken: `access-${sub}`, refreshToken: `refresh-${sub}`, expiresAt };
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function storage(initial = null) {
  let raw = initial;
  return { getItem: () => raw, setItem: (_key, value) => { raw = value; }, raw: () => raw };
}
function setup(options = {}) {
  const snapshots = [];
  const timers = new Map();
  let nextTimer = 0;
  const sharedStorage = options.storage ?? storage(options.initial ?? null);
  const coordinator = new SessionCoordinator({
    storage: sharedStorage,
    login: options.login ?? (async () => session()),
    refresh: options.refresh ?? (async () => session()),
    onChange: (value) => snapshots.push(value),
    now: () => NOW,
    revision: () => `revision-${++revision}`,
    schedule: (callback, delay) => {
      const id = ++nextTimer;
      timers.set(id, { callback: () => { timers.delete(id); callback(); }, delay });
      return id;
    },
    cancel: (id) => timers.delete(id),
  });
  return { coordinator, snapshots, timers, storage: sharedStorage, latest: () => snapshots.at(-1) };
}
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

for (const outcome of ["success", "failure"]) {
  test(`pending startup refresh ${outcome} cannot resurrect or clear a newer account`, async () => {
    const refresh = deferred();
    const owner = setup({ initial: JSON.stringify(session("user-a", "tenant-a", NOW - 1)), refresh: () => refresh.promise, login: async () => session("user-b", "tenant-b") });
    owner.coordinator.start();
    assert.equal(owner.latest().status, "loading");
    owner.coordinator.logout();
    await owner.coordinator.login("b@example.com", "password");
    if (outcome === "success") refresh.resolve(session());
    else refresh.reject(new Error("expired refresh token"));
    await settle();
    assert.equal(owner.latest().user.sub, "user-b");
    assert.equal(sessionFromStorage(owner.storage.raw()).refreshToken, "refresh-user-b");
    owner.coordinator.stop();
  });
}

test("logout invalidates a pending login even without a previous stored session", async () => {
  const login = deferred();
  const owner = setup({ login: () => login.promise });
  owner.coordinator.start();
  const pending = owner.coordinator.login("a@example.com", "password");
  const loginRevision = owner.storage.raw();
  owner.coordinator.logout();
  const logoutRevision = owner.storage.raw();
  assert.notEqual(logoutRevision, loginRevision);
  login.resolve(session());
  await pending;
  assert.equal(owner.latest().status, "unauthenticated");
  assert.equal(owner.storage.raw(), logoutRevision);
  assert.equal(sessionFromStorage(logoutRevision), null);
  owner.coordinator.stop();
});

test("a slow login cannot replace a more recent login", async () => {
  const first = deferred();
  const owner = setup({ login: (email) => email.startsWith("a") ? first.promise : Promise.resolve(session("user-b", "tenant-b")) });
  owner.coordinator.start();
  const oldLogin = owner.coordinator.login("a@example.com", "password");
  await owner.coordinator.login("b@example.com", "password");
  first.resolve(session());
  await oldLogin;
  assert.equal(owner.latest().user.sub, "user-b");
  owner.coordinator.stop();
});

test("a failed previous login does not report an error against a newer login", async () => {
  const first = deferred();
  const owner = setup({ login: (email) => email.startsWith("a") ? first.promise : Promise.resolve(session("user-b")) });
  owner.coordinator.start();
  const oldLogin = owner.coordinator.login("a@example.com", "password");
  await owner.coordinator.login("b@example.com", "password");
  first.reject(new Error("invalid old password"));
  await assert.doesNotReject(oldLogin);
  assert.equal(owner.latest().user.sub, "user-b");
  owner.coordinator.stop();
});

test("another tab's logout cancels refresh before the storage event is delivered", async () => {
  const refresh = deferred();
  const shared = storage(JSON.stringify(session("user-a", "tenant-a", NOW - 1)));
  const first = setup({ storage: shared, refresh: () => refresh.promise });
  const second = setup({ storage: shared, refresh: () => refresh.promise });
  first.coordinator.start();
  second.coordinator.start();
  second.coordinator.logout();
  const logoutRaw = shared.raw();
  refresh.resolve(session());
  await settle();
  assert.equal(first.latest().status, "unauthenticated");
  assert.equal(shared.raw(), logoutRaw);
  first.coordinator.stop();
  second.coordinator.stop();
});

test("another tab's logout cancels an initially anonymous login before storage notification", async () => {
  const login = deferred();
  const shared = storage();
  const first = setup({ storage: shared, login: () => login.promise });
  const second = setup({ storage: shared });
  first.coordinator.start();
  second.coordinator.start();
  const pending = first.coordinator.login("a@example.com", "password");
  second.coordinator.logout();
  const logoutRaw = shared.raw();
  login.resolve(session());
  await pending;
  assert.equal(first.latest().status, "unauthenticated");
  assert.equal(shared.raw(), logoutRaw);
  first.coordinator.stop();
  second.coordinator.stop();
});

test("storage sync adopts the current account and cancels the previous refresh timer", async () => {
  const owner = setup({ initial: JSON.stringify(session()) });
  owner.coordinator.start();
  const [oldTimer] = owner.timers.keys();
  owner.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session("user-b", "tenant-b")));
  owner.coordinator.syncStorage();
  assert.equal(owner.latest().user.sub, "user-b");
  assert.equal(owner.latest().user.tenantId, "tenant-b");
  assert.equal(owner.timers.has(oldTimer), false);
  assert.equal(owner.timers.size, 1);
  owner.storage.setItem(SESSION_STORAGE_KEY, null);
  owner.coordinator.syncStorage();
  assert.equal(owner.latest().status, "unauthenticated");
  assert.equal(owner.timers.size, 0);
  owner.coordinator.stop();
});

test("a disposed StrictMode lifetime cannot publish or persist its pending refresh", async () => {
  const oldRefresh = deferred();
  const shared = storage(JSON.stringify(session("user-a", "tenant-a", NOW - 1)));
  const discarded = setup({ storage: shared, refresh: () => oldRefresh.promise });
  discarded.coordinator.start();
  discarded.coordinator.stop();
  const replacement = setup({ storage: shared });
  replacement.coordinator.start();
  replacement.coordinator.logout();
  await replacement.coordinator.login("b@example.com", "password");
  const nextRaw = shared.raw();
  const oldSnapshots = discarded.snapshots.length;
  oldRefresh.resolve(session());
  await settle();
  assert.equal(discarded.snapshots.length, oldSnapshots);
  assert.equal(shared.raw(), nextRaw);
  assert.equal(discarded.timers.size, 0);
  replacement.coordinator.stop();
});

test("scheduled refresh is cancelled on logout and retains identity across renewal", async () => {
  const owner = setup({ initial: JSON.stringify(session()), refresh: async () => session("user-a", "tenant-a", NOW + 7_200_000, "renamed@example.com") });
  owner.coordinator.start();
  const identity = sessionIdentity(owner.latest().user);
  const timer = owner.timers.values().next().value;
  assert.equal(timer.delay, 3_540_000);
  timer.callback();
  await settle();
  assert.equal(sessionIdentity(owner.latest().user), identity);
  assert.equal(owner.latest().session.expiresAt, NOW + 7_200_000);
  owner.coordinator.logout();
  assert.equal(owner.latest().status, "unauthenticated");
  assert.equal(owner.timers.size, 0);
  owner.coordinator.stop();
});

test("a refresh returning a different tenant or subject fails closed", async () => {
  const owner = setup({ initial: JSON.stringify(session("user-a", "tenant-a", NOW - 1)), refresh: async () => session("user-a", "tenant-b") });
  owner.coordinator.start();
  await settle();
  assert.equal(owner.latest().status, "unauthenticated");
  assert.equal(sessionFromStorage(owner.storage.raw()), null);
  owner.coordinator.stop();
});

test("storage parsing rejects corrupt records and tokens without a stable identity", () => {
  assert.equal(sessionFromStorage("not-json"), null);
  assert.equal(sessionFromStorage(JSON.stringify({ ...session(), idToken: "broken" })), null);
  const payload = Buffer.from(JSON.stringify({ email: "a@example.com" })).toString("base64url");
  assert.equal(sessionFromStorage(JSON.stringify({ ...session(), idToken: `header.${payload}.signature` })), null);
  assert.equal(sessionFromStorage(JSON.stringify({ ...session(), expiresAt: "tomorrow" })), null);
  assert.equal(sessionFromStorage(JSON.stringify({ version: 999, session: session() })), null);
  assert.deepEqual(sessionFromStorage(JSON.stringify(session())), session());
  assert.deepEqual(sessionFromStorage(JSON.stringify({ version: 1, revision: "one", session: session() })), session());
  assert.notEqual(sessionIdentity(userFromIdToken(session().idToken)), sessionIdentity(userFromIdToken(session("user-a", "tenant-b").idToken)));
});

test("the current login failure remains visible to the caller", async () => {
  const owner = setup({ login: async () => { throw new Error("invalid password"); } });
  owner.coordinator.start();
  await assert.rejects(owner.coordinator.login("a@example.com", "wrong"), /invalid password/);
  assert.equal(owner.latest().status, "unauthenticated");
  owner.coordinator.stop();
});

test("login works for this tab when storage reads succeed but persistence is blocked", async () => {
  const owner = setup({ storage: { getItem: () => null, setItem: () => { throw new Error("quota exceeded"); } } });
  owner.coordinator.start();
  await owner.coordinator.login("a@example.com", "password");
  assert.equal(owner.latest().status, "authenticated");
  owner.coordinator.logout();
  assert.equal(owner.latest().status, "unauthenticated");
  owner.coordinator.stop();
});
