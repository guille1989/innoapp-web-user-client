import assert from "node:assert/strict";
import test from "node:test";
import { parseMessageBlocks } from "../src/lib/markdownTables.ts";

const answer = `Aquí están los **clientes**:

| Cliente | Total |
|---------|-------|
| D1 S A S | 311.819.056 |
| MIGAN CAPITAL S.A.S. | 3.881.800 |

Fin.`;

test("separa texto y tabla, y alinea a la derecha las columnas numéricas", () => {
  const blocks = parseMessageBlocks(answer);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[0], { type: "text", text: "Aquí están los **clientes**:" });
  assert.deepEqual(blocks[1], {
    type: "table",
    header: ["Cliente", "Total"],
    align: ["left", "right"],
    rows: [["D1 S A S", "311.819.056"], ["MIGAN CAPITAL S.A.S.", "3.881.800"]],
  });
  assert.deepEqual(blocks[2], { type: "text", text: "Fin." });
});

test("sin tabla devuelve un único bloque de texto", () => {
  assert.deepEqual(parseMessageBlocks("a | b\nsolo texto"), [{ type: "text", text: "a | b\nsolo texto" }]);
});

test("respeta la alineación explícita y rellena celdas faltantes", () => {
  const [table] = parseMessageBlocks("| A | B |\n|:--|:-:|\n| 1 |");
  assert.deepEqual(table, { type: "table", header: ["A", "B"], align: ["left", "center"], rows: [["1", ""]] });
});

test("una barra sin fila separadora no es tabla", () => {
  assert.equal(parseMessageBlocks("| solo una línea |\notra").length, 1);
});
