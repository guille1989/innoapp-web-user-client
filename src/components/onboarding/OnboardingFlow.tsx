import { useEffect, useMemo, useState } from "react";
import type { ApiActivationCode, ApiAgent, ApiOnboardingState, ApiTicket, ApiWidget, OnboardingAction } from "../../api/client";
import { AGENT_DOWNLOAD_URL, AGENT_VERSION } from "../robots/agentInstall";

type Step = "welcome" | "install" | "activate" | "connect" | "data" | "dashboard" | "ready";
const STEPS: Step[] = ["welcome", "install", "activate", "connect", "data", "dashboard", "ready"];

interface OnboardingFlowProps {
  businessName: string;
  state: ApiOnboardingState;
  agents: ApiAgent[];
  codes: ApiActivationCode[];
  tickets: ApiTicket[];
  widgets: ApiWidget[];
  onRefresh: () => Promise<void>;
  onAction: (action: OnboardingAction) => Promise<ApiOnboardingState>;
  onDefer: () => void;
  onComplete: () => void;
}

export function OnboardingFlow({ businessName, state, agents, codes, tickets, widgets, onRefresh, onAction, onDefer, onComplete }: OnboardingFlowProps) {
  const connectedAgent = agents.find((agent) => Boolean(agent.lastSeenAt));
  const unusedCodes = codes.filter((code) => code.status === "unused");
  const [step, setStep] = useState<Step>(state.startedAt ? (connectedAgent ? "data" : "install") : "welcome");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const index = STEPS.indexOf(step);

  useEffect(() => { if (!state.startedAt) void onAction("start"); }, [state.startedAt, onAction]);
  useEffect(() => {
    if (step !== "connect" && step !== "data") return;
    const timer = window.setInterval(() => void onRefresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [step, onRefresh]);

  const progress = useMemo(() => Math.round(index / (STEPS.length - 1) * 100), [index]);

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    window.setTimeout(() => setCopied(null), 1400);
  }

  async function defer() {
    setBusy(true);
    setError(null);
    try { await onAction("defer"); onDefer(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  async function createDashboard() {
    setBusy(true);
    setError(null);
    try { await onAction("create-starter-dashboard"); await onRefresh(); setStep("ready"); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try { await onAction("complete"); onComplete(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-grid" />
      <header className="onboarding-header">
        <div className="onboarding-brand"><img src="/brand/innoapp-mark.png" alt="" /><strong>Inno<span>App</span></strong></div>
        {step !== "welcome" && step !== "ready" && <button className="onboarding-later" disabled={busy} onClick={() => void defer()}>Continuar más tarde</button>}
      </header>
      <section className="onboarding-card">
        <div className="onboarding-progress"><span style={{ width: `${progress}%` }} /></div>
        <div className="onboarding-step-label">Configuración inicial · {index + 1} de {STEPS.length}</div>

        {step === "welcome" && <div className="onboarding-content hero-step"><div className="onboarding-symbol">✓</div><span className="eyebrow">Cuenta preparada</span><h1>Bienvenido a InnoApp, {businessName}.</h1><p>Vamos a conectar tu primer equipo y convertir sus tickets en información útil. Solo te llevará unos minutos.</p><button className="onboarding-primary" onClick={() => setStep("install")}>Empezar configuración <span>→</span></button></div>}

        {step === "install" && <div className="onboarding-content"><span className="eyebrow">Paso 1</span><h1>Instala InnoApp Agent</h1><p>Descarga el agente en el ordenador conectado a tu impresora o punto de venta.</p><div className="onboarding-detail"><div className="detail-icon">↓</div><div><strong>InnoApp Agent para Windows</strong><span>Windows 10/11 · 64 bits · Versión {AGENT_VERSION}</span></div><a href={AGENT_DOWNLOAD_URL} className="onboarding-download">Descargar instalador</a></div><div className="onboarding-actions"><button className="onboarding-secondary" onClick={() => setStep("welcome")}>Atrás</button><button className="onboarding-primary" onClick={() => setStep("activate")}>Ya lo he descargado <span>→</span></button></div></div>}

        {step === "activate" && <div className="onboarding-content"><span className="eyebrow">Paso 2</span><h1>Activa este equipo</h1><p>Abre el agente e introduce uno de estos códigos. Cada código se puede utilizar una sola vez.</p><div className="onboarding-codes">{unusedCodes.slice(0, 3).map((code) => <button key={code.code} onClick={() => void copyCode(code.code)}><span>{code.code}</span><small>{copied === code.code ? "Copiado" : "Copiar"}</small></button>)}{unusedCodes.length === 0 && <div className="onboarding-empty">No quedan códigos disponibles. Comprueba si el agente ya aparece conectado.</div>}</div><div className="onboarding-actions"><button className="onboarding-secondary" onClick={() => setStep("install")}>Atrás</button><button className="onboarding-primary" onClick={() => setStep("connect")}>Comprobar conexión <span>→</span></button></div></div>}

        {step === "connect" && <div className="onboarding-content"><span className="eyebrow">Paso 3</span><h1>{connectedAgent ? "Agente conectado" : "Esperando al agente…"}</h1><p>{connectedAgent ? `${connectedAgent.name} ya está comunicándose de forma segura con InnoApp.` : "Mantén abierto InnoApp Agent. Esta pantalla se actualizará automáticamente cuando llegue su primera señal."}</p><div className={`connection-orbit${connectedAgent ? " connected" : ""}`}><div className="connection-core"><img src="/brand/innoapp-mark.png" alt="" /></div><i /><i /><i /><span>{connectedAgent ? "Conectado" : "Buscando"}</span></div><div className="onboarding-actions"><button className="onboarding-secondary" onClick={() => setStep("activate")}>Atrás</button><button className="onboarding-primary" disabled={!connectedAgent} onClick={() => setStep("data")}>{connectedAgent ? "Continuar" : "Esperando conexión"} <span>→</span></button></div></div>}

        {step === "data" && <div className="onboarding-content"><span className="eyebrow">Paso 4</span><h1>{tickets.length > 0 ? "Primer ticket recibido" : "Todo listo para recibir datos"}</h1><p>{tickets.length > 0 ? "Ya tenemos actividad real. Podemos preparar tu espacio de datos." : "Genera una venta o impresión de prueba. Puedes continuar ahora y los widgets se actualizarán cuando llegue el primer ticket."}</p><div className={`first-event-card${tickets.length > 0 ? " received" : ""}`}><i />{tickets.length > 0 ? <><strong>{tickets[0].port}</strong><span>{new Date(tickets[0].capturedAt).toLocaleString("es-ES")}</span></> : <><strong>Esperando el primer ticket</strong><span>La comprobación continúa automáticamente</span></>}</div><div className="onboarding-actions"><button className="onboarding-secondary" onClick={() => setStep("connect")}>Atrás</button><button className="onboarding-primary" onClick={() => setStep("dashboard")}>{tickets.length > 0 ? "Preparar dashboard" : "Continuar sin esperar"} <span>→</span></button></div></div>}

        {step === "dashboard" && <div className="onboarding-content"><span className="eyebrow">Paso 5</span><h1>Prepara tu primer dashboard</h1><p>Crearemos una base con tickets procesados, ventas totales y evolución diaria. Después podrás modificarla libremente.</p><div className="starter-widgets"><div><small>KPI</small><strong>Tickets procesados</strong><span>Conteo total</span></div><div><small>KPI</small><strong>Ventas totales</strong><span>Suma de importes</span></div><div><small>GRÁFICA</small><strong>Evolución de ventas</strong><span>Agrupada por día</span></div></div><div className="onboarding-actions"><button className="onboarding-secondary" onClick={() => setStep("data")}>Atrás</button>{widgets.length > 0 || state.starterDashboardCreatedAt ? <button className="onboarding-primary" onClick={() => setStep("ready")}>Usar dashboard actual <span>→</span></button> : <button className="onboarding-primary" disabled={busy} onClick={() => void createDashboard()}>{busy ? "Creando…" : "Crear dashboard inicial"} <span>→</span></button>}</div></div>}

        {step === "ready" && <div className="onboarding-content hero-step"><div className="onboarding-symbol ready-symbol">✓</div><span className="eyebrow">Configuración completada</span><h1>InnoApp está listo.</h1><p>Tu agente está conectado y tu espacio preparado. Ahora te enseñaremos las partes principales de la aplicación.</p><button className="onboarding-primary" disabled={busy || !connectedAgent} onClick={() => void complete()}>{busy ? "Finalizando…" : "Ver mis datos"} <span>→</span></button></div>}

        {error && <div className="onboarding-error" role="alert">{error}</div>}
      </section>
    </main>
  );
}
