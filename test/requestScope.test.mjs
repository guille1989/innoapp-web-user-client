import assert from "node:assert/strict";
import test from "node:test";
import { RequestScope } from "../src/lib/requestScope.ts";

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

test("a replaced request cannot apply a late response even when transport ignores abort", async () => {
  const scope = new RequestScope();
  const oldResponse = deferred();
  const currentResponse = deferred();
  const accepted = [];
  const oldTask = scope.start("dashboard");
  const first = oldResponse.promise.then((data) => { if (oldTask.isCurrent()) accepted.push(data); oldTask.finish(); });
  const currentTask = scope.start("dashboard");
  const second = currentResponse.promise.then((data) => { if (currentTask.isCurrent()) accepted.push(data); currentTask.finish(); });
  assert.equal(oldTask.signal.aborted, true);
  currentResponse.resolve("new metrics");
  await second;
  oldResponse.resolve("old metrics");
  await first;
  assert.deepEqual(accepted, ["new metrics"]);
});

test("the finally block of an old request cannot remove its replacement", () => {
  const scope = new RequestScope();
  const oldTask = scope.start("profile");
  const currentTask = scope.start("profile");
  oldTask.finish();
  assert.equal(currentTask.isCurrent(), true);
  currentTask.finish();
  assert.equal(currentTask.isCurrent(), false);
});

test("different request keys remain independent", () => {
  const scope = new RequestScope();
  const agents = scope.start("agents");
  const widgets = scope.start("widgets");
  const replacement = scope.start("agents");
  assert.equal(agents.signal.aborted, true);
  assert.equal(widgets.signal.aborted, false);
  assert.equal(widgets.isCurrent(), true);
  assert.equal(replacement.isCurrent(), true);
  scope.dispose();
});

test("dispose aborts every active read and suppresses already queued responses", async () => {
  const scope = new RequestScope();
  const response = deferred();
  const profile = scope.start("profile");
  const widgets = scope.start("widgets");
  const accepted = [];
  const completion = response.promise.then((value) => { if (profile.isCurrent()) accepted.push(value); });
  scope.dispose();
  response.resolve("another account's profile");
  await completion;
  assert.equal(profile.signal.aborted, true);
  assert.equal(widgets.signal.aborted, true);
  assert.equal(profile.isCurrent(), false);
  assert.equal(widgets.isCurrent(), false);
  assert.deepEqual(accepted, []);
});

test("StrictMode reactivation never revives requests from its discarded lifetime", () => {
  const scope = new RequestScope();
  const discarded = scope.start("profile");
  scope.dispose();
  scope.activate();
  assert.equal(discarded.isCurrent(), false);
  const replacement = scope.start("profile");
  discarded.finish();
  assert.equal(replacement.isCurrent(), true);
  assert.equal(replacement.signal.aborted, false);
  scope.dispose();
});

test("callbacks retained after unmount get an already aborted signal", () => {
  const scope = new RequestScope();
  scope.dispose();
  const stale = scope.start("create-widget");
  assert.equal(stale.signal.aborted, true);
  assert.equal(stale.isCurrent(), false);
  scope.activate();
  assert.equal(stale.isCurrent(), false);
  scope.dispose();
});

test("cancel prevents an older list response from undoing a successful deletion", async () => {
  const scope = new RequestScope();
  const oldList = deferred();
  let reports = ["retained", "deleted"];
  const read = scope.start("reports");
  const completion = oldList.promise.then((value) => { if (read.isCurrent()) reports = value; read.finish(); });
  scope.cancel("reports");
  reports = reports.filter((id) => id !== "deleted");
  oldList.resolve(["retained", "deleted"]);
  await completion;
  assert.deepEqual(reports, ["retained"]);
  assert.equal(read.signal.aborted, true);
  assert.equal(read.isCurrent(), false);
});

test("cancelling a profile read leaves unrelated mutations active", () => {
  const scope = new RequestScope();
  const profile = scope.start("profile");
  const mutation = scope.start("action");
  scope.cancel("profile");
  assert.equal(profile.isCurrent(), false);
  assert.equal(profile.signal.aborted, true);
  assert.equal(mutation.isCurrent(), true);
  const refreshedProfile = scope.start("profile");
  profile.finish();
  assert.equal(refreshedProfile.isCurrent(), true);
  scope.dispose();
});
