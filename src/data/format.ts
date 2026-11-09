/**
 * Formatea un monto o cantidad. Sin moneda configurada no pone símbolo
 * (multi-tenant: no adivinamos país). Con currency/locale del profile, usa
 * Intl currency. El locale por defecto sigue siendo es-AR para miles.
 */

export type AmountFormatOptions = {
  currency?: string;
  locale?: string;
};

let configured: AmountFormatOptions = {};

/** Aplica la ficha del negocio (GET /me.profile) a todos los montos de la UI. */
export function configureAmountFormat(opts: AmountFormatOptions = {}): void {
  configured = {
    ...(opts.currency ? { currency: opts.currency } : {}),
    ...(opts.locale ? { locale: opts.locale } : {}),
  };
}

export function fmtAmount(n: number, opts?: AmountFormatOptions): string {
  const currency = opts?.currency ?? configured.currency;
  const locale = opts?.locale ?? configured.locale ?? "es-AR";
  const value = Math.round(n);
  if (currency) {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      // currency/locale inválidos: cae al formato sin símbolo
    }
  }
  return value.toLocaleString(locale);
}
