import assert from "node:assert/strict";
import test from "node:test";
import { api } from "../src/api/client.ts";
import { openStoredReportPdf, downloadStoredReportCsv } from "../src/lib/storedReports.ts";
import { RequestScope } from "../src/lib/requestScope.ts";

const item = { reportId: "report-a", title: "Ventas de A", createdAt: "2026-10-20", expiresAt: "2026-11-20" };
const stored = { report: { title: "Ventas de A", generatedAt: "2026-10-20", sections: [] }, summary: "Datos de A" };
function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}
function fakeWindow(t) {
  const calls = { open: 0, close: 0, write: 0, focus: 0, print: 0 };
  const popup = {
    close: () => { calls.close += 1; },
    document: { write: () => { calls.write += 1; }, close: () => {} },
    focus: () => { calls.focus += 1; },
    setTimeout: (callback) => callback(),
    print: () => { calls.print += 1; },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { open: () => { calls.open += 1; return popup; } } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  });
  return calls;
}
function fakeDownload(t) {
  const calls = { create: 0, click: 0, revoke: 0 };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ click: () => { calls.click += 1; } }) } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else delete globalThis.document;
  });
  t.mock.method(URL, "createObjectURL", () => { calls.create += 1; return "blob:report"; });
  t.mock.method(URL, "revokeObjectURL", () => { calls.revoke += 1; });
  return calls;
}

test("logout closes a pending PDF immediately and prevents late content from the old account", async (t) => {
  const response = deferred();
  const calls = fakeWindow(t);
  const scope = new RequestScope();
  const task = scope.start("report-a");
  t.mock.method(api, "report", async (_token, reportId, signal) => {
    assert.equal(reportId, item.reportId);
    assert.equal(signal, task.signal);
    return response.promise; // Simulate a transport that ignores cancellation.
  });
  const pending = openStoredReportPdf("token-a", item, "Negocio A", task.signal);
  assert.equal(calls.open, 1);
  scope.dispose();
  assert.equal(calls.close, 1);
  response.resolve(stored);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls.close, 1);
  assert.equal(calls.write, 0);
  assert.equal(calls.print, 0);
});

test("logout prevents a late CSV response from triggering a download", async (t) => {
  const response = deferred();
  const calls = fakeDownload(t);
  const scope = new RequestScope();
  const task = scope.start("report-a");
  t.mock.method(api, "report", async (_token, _reportId, signal) => { assert.equal(signal, task.signal); return response.promise; });
  const pending = downloadStoredReportCsv("token-a", item, task.signal);
  scope.dispose();
  response.resolve(stored);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls.create, 0);
  assert.equal(calls.click, 0);
});

test("already cancelled exports make no request and open no popup", async (t) => {
  const calls = fakeWindow(t);
  const controller = new AbortController();
  controller.abort();
  const request = t.mock.method(api, "report", async () => stored);
  await assert.rejects(openStoredReportPdf("token-a", item, "Negocio A", controller.signal), { name: "AbortError" });
  await assert.rejects(downloadStoredReportCsv("token-a", item, controller.signal), { name: "AbortError" });
  assert.equal(request.mock.callCount(), 0);
  assert.equal(calls.open, 0);
});

test("a successful PDF fills and prints its preopened window", async (t) => {
  const calls = fakeWindow(t);
  t.mock.method(api, "report", async () => stored);
  await openStoredReportPdf("token-a", item, "Negocio A", new AbortController().signal);
  assert.equal(calls.open, 1);
  assert.equal(calls.close, 0);
  assert.equal(calls.write, 1);
  assert.equal(calls.print, 1);
});

test("a successful CSV triggers one download and releases the blob", async (t) => {
  const calls = fakeDownload(t);
  t.mock.method(api, "report", async () => stored);
  await downloadStoredReportCsv("token-a", item, new AbortController().signal);
  assert.equal(calls.create, 1);
  assert.equal(calls.click, 1);
  assert.equal(calls.revoke, 1);
});

test("a failed PDF fetch closes the preopened window and preserves the error", async (t) => {
  const calls = fakeWindow(t);
  t.mock.method(api, "report", async () => { throw new Error("API failure"); });
  await assert.rejects(openStoredReportPdf("token-a", item, "Negocio A"), /API failure/);
  assert.equal(calls.close, 1);
  assert.equal(calls.write, 0);
});
