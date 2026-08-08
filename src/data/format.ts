export function fmtCurrency(n: number): string {
  return "€" + Math.round(n).toLocaleString("es-ES");
}
