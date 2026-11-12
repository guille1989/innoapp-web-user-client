import assert from "node:assert/strict";
import test from "node:test";
import { draftToWidget } from "../src/components/ai/useAssistantChat.tsx";

test("draftToWidget persiste paymentMethod del draft del asistente", () => {
  const widget = draftToWidget({
    name: "Ventas datafono",
    visualization: "kpi",
    metric: { field: "total", aggregation: "sum" },
    filters: { paymentMethod: "Datafono" },
  });
  assert.equal(widget.paymentMethod, "Datafono");
  assert.equal(widget.title, "Ventas datafono");
  assert.equal(widget.type, "kpi");
  assert.equal(widget.field, "total");
});

test("draftToWidget conserva agentId, descriptionContains y paymentMethod juntos", () => {
  const widget = draftToWidget({
    name: "Café · Sol · QR",
    visualization: "kpi",
    metric: { field: "subtotal", aggregation: "sum" },
    filters: { agentId: "agent-sol", descriptionContains: "cafe", paymentMethod: "QR" },
  });
  assert.deepEqual(
    { agentId: widget.agentId, descriptionContains: widget.descriptionContains, paymentMethod: widget.paymentMethod },
    { agentId: "agent-sol", descriptionContains: "cafe", paymentMethod: "QR" },
  );
});

test("draftToWidget omite paymentMethod si el draft no lo trae", () => {
  const widget = draftToWidget({
    name: "Tickets",
    visualization: "kpi",
    metric: { field: "event_count", aggregation: "count" },
  });
  assert.equal(widget.paymentMethod, undefined);
});
