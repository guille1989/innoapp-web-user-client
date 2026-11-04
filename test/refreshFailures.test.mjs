import assert from "node:assert/strict";
import test from "node:test";
import { collectFailures, summarizeFailures } from "../src/lib/refreshFailures.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("un recurso que falla no impide que los demás apliquen su resultado", async () => {
  const applied = [];
  const ok = (key, value) => Promise.resolve(value).then((v) => { applied.push([key, v]); });
  const failures = await collectFailures({
    tickets: ok("tickets", [1, 2]),
    review: ok("review", [3]),
    agents: ok("agents", ["robot"]),
    codes: Promise.reject(new Error("HTTP 500")),
    widgets: ok("widgets", true),
  });

  assert.deepEqual(failures, { codes: "HTTP 500" });
  assert.deepEqual(applied.map(([key]) => key).sort(), ["agents", "review", "tickets", "widgets"]);
});

test("no corta en el primer fallo: espera a un recurso lento que llega después", async () => {
  const slow = deferred();
  const applied = [];
  const pending = collectFailures({
    tickets: Promise.reject(new Error("HTTP 503")),
    review: Promise.resolve(),
    agents: Promise.resolve(),
    codes: Promise.resolve(),
    widgets: slow.promise.then((v) => { applied.push(v); }),
  });

  let settled = false;
  void pending.then(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  // Con Promise.all ya habría terminado (y cerrado la tarea) antes de que lleguen los widgets.
  assert.equal(settled, false);

  slow.resolve("datos del widget");
  const failures = await pending;
  assert.deepEqual(applied, ["datos del widget"]);
  assert.deepEqual(failures, { tickets: "HTTP 503" });
});

test("sin fallos devuelve un objeto vacío", async () => {
  const failures = await collectFailures({
    tickets: Promise.resolve(),
    review: Promise.resolve(),
    agents: Promise.resolve(),
    codes: Promise.resolve(),
    widgets: Promise.resolve(),
  });
  assert.deepEqual(failures, {});
  assert.equal(summarizeFailures(failures), null);
});

test("un rechazo que no es un Error también queda registrado", async () => {
  const failures = await collectFailures({
    tickets: Promise.reject("texto suelto"),
    review: Promise.resolve(),
    agents: Promise.resolve(),
    codes: Promise.resolve(),
    widgets: Promise.resolve(),
  });
  assert.deepEqual(failures, { tickets: "texto suelto" });
});

test("summarizeFailures nombra las secciones afectadas y la causa", () => {
  assert.equal(summarizeFailures({ codes: "HTTP 500" }), "No se pudo actualizar los códigos de activación: HTTP 500");
  assert.equal(
    summarizeFailures({ agents: "timeout", tickets: "HTTP 503" }),
    "No se pudo actualizar la actividad y los robots: HTTP 503",
  );
  assert.equal(
    summarizeFailures({ widgets: "x", review: "y", codes: "z" }),
    "No se pudo actualizar la cola de revisión, los códigos de activación y los widgets: y",
  );
});
