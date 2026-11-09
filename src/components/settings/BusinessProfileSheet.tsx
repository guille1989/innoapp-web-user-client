import { useEffect, useState } from "react";
import type { ApiBusinessProfile, ApiBusinessProfilePatch } from "../../api/client";
import { openingHoursSummary } from "../../lib/businessProfile";

const CURRENCIES = ["COP", "USD", "EUR", "MXN", "ARS", "CLP", "PEN"] as const;

interface BusinessProfileSheetProps {
  open: boolean;
  profile: ApiBusinessProfile | null | undefined;
  businessName: string;
  onClose: () => void;
  onSave: (patch: ApiBusinessProfilePatch) => Promise<ApiBusinessProfile | null>;
}

export function BusinessProfileSheet({ open, profile, businessName, onClose, onSave }: BusinessProfileSheetProps) {
  const [currency, setCurrency] = useState("");
  const [locale, setLocale] = useState("");
  const [industry, setIndustry] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [hasHours, setHasHours] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrency(profile?.currency ?? "");
    setLocale(profile?.locale ?? "");
    setIndustry(profile?.industry ?? "");
    const def = profile?.openingHours?.default;
    setHasHours(Boolean(def));
    setOpenTime(def?.open ?? "08:00");
    setCloseTime(def?.close ?? "20:00");
    setError(null);
    setSavedNotice(null);
  }, [open, profile]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const patch: ApiBusinessProfilePatch = {
        currency: currency.trim() ? currency.trim().toUpperCase() : null,
        locale: locale.trim() ? locale.trim() : null,
        industry: industry.trim() ? industry.trim() : null,
        openingHours: hasHours ? { default: { open: openTime, close: closeTime } } : null,
      };
      const next = await onSave(patch);
      const hours = openingHoursSummary(next?.openingHours ?? undefined);
      setSavedNotice(
        [
          next?.currency ? `Moneda ${next.currency}` : "Sin moneda",
          hours ? `horario ${hours}` : "sin horarios",
          next?.industry ? next.industry : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "No se pudo guardar la ficha");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`sheet builder-sheet${open ? " open" : ""}`} id="businessProfileSheet" aria-hidden={!open}>
      <div className="sheet-handle" />
      <div className="builder-head">
        <div className="modal-title">Ficha del negocio</div>
        <div className="modal-sub">
          Datos que Innova usa para hablar de {businessName || "tu negocio"} (moneda, horarios, rubro).
        </div>
      </div>
      <div className="builder-body">
        {error && <div role="alert">{error}</div>}
        {savedNotice && !error && <div className="profile-saved" role="status">Guardado: {savedNotice}</div>}

        <div className="field">
          <label className="field-label" htmlFor="profileCurrency">Moneda</label>
          <select id="profileCurrency" className="select" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={saving}>
            <option value="">Sin definir (solo números)</option>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="profileLocale">Locale (opcional)</label>
          <input
            id="profileLocale"
            className="text-input"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            placeholder="es-CO"
            disabled={saving}
            maxLength={12}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="profileIndustry">Rubro</label>
          <input
            id="profileIndustry"
            className="text-input"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="restaurante, retail…"
            disabled={saving}
            maxLength={40}
          />
        </div>

        <div className="field">
          <label className="field-label">
            <input type="checkbox" checked={hasHours} onChange={(e) => setHasHours(e.target.checked)} disabled={saving} />{" "}
            Declarar horario de apertura
          </label>
          {hasHours && (
            <div className="profile-hours-row">
              <label>
                Abre
                <input type="time" className="text-input" value={openTime} onChange={(e) => setOpenTime(e.target.value)} disabled={saving} />
              </label>
              <label>
                Cierra
                <input type="time" className="text-input" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} disabled={saving} />
              </label>
            </div>
          )}
        </div>

        <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar ficha"}
        </button>
        <button type="button" className="chip" style={{ marginTop: 8 }} onClick={onClose} disabled={saving}>Cerrar</button>
      </div>
    </div>
  );
}
