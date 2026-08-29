/**
 * Formatea un monto o cantidad SIN símbolo de moneda. El sistema es
 * multi-tenant y todavía no sabe en qué país/moneda opera cada negocio,
 * así que mostrar "$" o "€" sería adivinar. Se fija el locale para que la
 * separación de miles sea determinista (no depende del navegador).
 *
 * TODO: moneda + locale por tenant (campo en TenantRecord, resuelto en el
 * signup a partir del país, devuelto por GET /me) cuando haya clientes reales.
 */
export function fmtAmount(n: number): string {
  return Math.round(n).toLocaleString("es-AR");
}
