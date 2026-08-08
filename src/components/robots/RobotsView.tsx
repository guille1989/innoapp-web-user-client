import { useMemo, useState } from "react";
import { RobotList } from "./RobotList";
import { RobotMap } from "./RobotMap";
import { RecordsList } from "./RecordsList";
import type { BusinessEvent, Robot } from "../../types";
import type { ApiActivationCode } from "../../api/client";

interface RobotsViewProps {
  active: boolean;
  events: BusinessEvent[];
  latestEventId: string | null;
  robots: Robot[];
  codes: ApiActivationCode[];
}

type PanelTab = "install" | "agents" | "codes" | "records";
const AGENT_DOWNLOAD_URL = (import.meta.env.VITE_AGENT_DOWNLOAD_URL as string | undefined)?.trim() || "/downloads/InnoAppAgent-Setup.exe";
const AGENT_VERSION = (import.meta.env.VITE_AGENT_VERSION as string | undefined)?.trim() || "0.1.0-pilot";

export function RobotsView({ active, events, latestEventId, robots, codes }: RobotsViewProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<PanelTab>("install");
  const [copied, setCopied] = useState<string | null>(null);
  const online = useMemo(() => robots.filter((robot) => robot.status === "online").length, [robots]);
  const unusedCodes = codes.filter((code) => code.status === "unused");

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <section className={`agents-canvas view${active ? " active" : ""}`}>
      <RobotMap active={active} robots={robots} />
      <div className="map-vignette" />
      <div className="map-legend glass"><span><i className="online" />Activo</span><span><i className="warn" />Intermitente</span><span><i className="offline" />Inactivo</span></div>
      <aside className={`agents-panel glass${panelOpen ? " open" : ""}`}>
        <button className="agents-panel-toggle" onClick={() => setPanelOpen((value) => !value)} aria-expanded={panelOpen}>
          <span><i className="online" /> {online} / {robots.length} agentes activos</span><b>{panelOpen ? "−" : "+"}</b>
        </button>
        {panelOpen && (
          <div className="agents-panel-content">
            <nav className="panel-tabs">
              <button className={tab === "install" ? "active" : ""} onClick={() => setTab("install")}>Instalar</button>
              <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>Agentes</button>
              <button className={tab === "codes" ? "active" : ""} onClick={() => setTab("codes")}>Códigos <em>{unusedCodes.length}</em></button>
              <button className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>Registros</button>
            </nav>
            {tab === "install" && (
              <div className="panel-scroll install-panel">
                <div className="pilot-heading"><span>Programa piloto</span><h2>Instala InnoApp Agent</h2><p>Conecta este equipo al negocio para detectar dispositivos y enviar sus datos de forma segura.</p></div>
                <ol className="install-steps">
                  <li>
                    <div className="step-number">1</div>
                    <div className="step-content"><strong>Descarga el instalador</strong><span>Windows 10/11 · 64 bits · Versión {AGENT_VERSION}</span>
                      {AGENT_DOWNLOAD_URL ? <a className="download-agent" href={AGENT_DOWNLOAD_URL}>Descargar para Windows <b>↓</b></a> : <button className="download-agent unavailable" disabled>Instalador pendiente de publicar</button>}
                    </div>
                  </li>
                  <li>
                    <div className="step-number">2</div>
                    <div className="step-content"><strong>Copia un código de activación</strong><span>Cada código se puede utilizar una sola vez.</span>
                      <div className="inline-codes">{unusedCodes.slice(0, 3).map((code) => <button key={code.code} onClick={() => void copyCode(code.code)}><span className="mono">{code.code}</span><small>{copied === code.code ? "Copiado" : "Copiar"}</small></button>)}{unusedCodes.length === 0 && <em>No hay códigos disponibles.</em>}</div>
                    </div>
                  </li>
                  <li><div className="step-number">3</div><div className="step-content"><strong>Activa y comprueba la conexión</strong><span>Abre InnoApp Agent, introduce el código y espera a que aparezca en la pestaña Agentes.</span><div className="pilot-status"><i className={online > 0 ? "online" : "offline"} /><span>{online > 0 ? `${online} agente${online === 1 ? "" : "s"} conectado${online === 1 ? "" : "s"}` : "Esperando el primer agente"}</span></div></div></li>
                </ol>
                {!AGENT_DOWNLOAD_URL && <div className="release-note">La descarga se activará automáticamente al configurar <span className="mono">VITE_AGENT_DOWNLOAD_URL</span> en el despliegue web.</div>}
              </div>
            )}
            {tab === "agents" && <div className="panel-scroll"><RobotList robots={robots} />{robots.length === 0 && <div className="empty-state">Todavía no hay agentes activados.</div>}</div>}
            {tab === "codes" && <div className="panel-scroll codes-panel"><p>Utiliza un código para vincular un nuevo agente.</p>{unusedCodes.map((code) => <button key={code.code} className="activation-code" onClick={() => void copyCode(code.code)}><span className="mono">{code.code}</span><small>{copied === code.code ? "Copiado" : "Copiar"}</small></button>)}{unusedCodes.length === 0 && <div className="empty-state">No quedan códigos disponibles.</div>}</div>}
            {tab === "records" && <div className="panel-scroll records-panel"><RecordsList events={events} latestEventId={latestEventId} /></div>}
          </div>
        )}
      </aside>
    </section>
  );
}
