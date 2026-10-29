export type TableAlign = "left" | "right" | "center";
export type MessageBlock =
  | { type: "text"; text: string }
  | { type: "table"; header: string[]; align: TableAlign[]; rows: string[][] };

const NUMERIC_CELL = /^[$€]?\s*-?[\d.,]+\s*[%$€]?$/;

function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
}

const isRow = (line: string | undefined) => line !== undefined && line.trim().startsWith("|") && line.trim().length > 1;
const isSeparator = (line: string | undefined) => isRow(line) && splitRow(line!).every((cell) => /^:?-{1,}:?$/.test(cell));

function alignOf(cell: string): TableAlign | undefined {
  if (cell.startsWith(":") && cell.endsWith(":")) return "center";
  if (cell.endsWith(":")) return "right";
  if (cell.startsWith(":")) return "left";
  return undefined;
}

/**
 * Separa la respuesta del modelo en bloques de texto y tablas markdown
 * (`| a | b |` + fila `|---|---|`). Todo lo demás queda como texto.
 * Las columnas sin alineación explícita van a la derecha si todas sus celdas
 * son numéricas.
 */
export function parseMessageBlocks(text: string): MessageBlock[] {
  const lines = text.split("\n");
  const blocks: MessageBlock[] = [];
  let pending: string[] = [];
  const flush = () => {
    const joined = pending.join("\n").replace(/^\n+|\n+$/g, "");
    if (joined) blocks.push({ type: "text", text: joined });
    pending = [];
  };

  for (let i = 0; i < lines.length; i++) {
    if (!isRow(lines[i]) || !isSeparator(lines[i + 1])) {
      pending.push(lines[i]);
      continue;
    }
    flush();
    const header = splitRow(lines[i]);
    const explicit = splitRow(lines[i + 1]).map(alignOf);
    const rows: string[][] = [];
    i += 2;
    while (i < lines.length && isRow(lines[i])) {
      const cells = splitRow(lines[i]);
      rows.push(header.map((_, c) => cells[c] ?? ""));
      i++;
    }
    i--;
    const align = header.map((_, c): TableAlign => {
      if (explicit[c]) return explicit[c]!;
      const column = rows.map((row) => row[c]).filter(Boolean);
      return column.length > 0 && column.every((cell) => NUMERIC_CELL.test(cell)) ? "right" : "left";
    });
    blocks.push({ type: "table", header, align, rows });
  }
  flush();
  return blocks;
}
