/** URL del setup NSIS publicado. En release debe apuntar al mismo build que VITE_AGENT_VERSION. */
export const AGENT_DOWNLOAD_URL = (import.meta.env.VITE_AGENT_DOWNLOAD_URL as string | undefined)?.trim() || "/downloads/InnoAppAgent-Setup.exe";
/**
 * Versión de marketing del instalador (producto Windows).
 * Debe coincidir con agent-status-viewer / print-capture-agent en cada release
 * (ver checklist del viewer). No confundir con `ApiAgent.version` (reportada
 * por heartbeat del agent ya instalado).
 */
export const AGENT_VERSION = (import.meta.env.VITE_AGENT_VERSION as string | undefined)?.trim() || "0.6.0";
