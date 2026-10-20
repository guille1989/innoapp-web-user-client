import L from "leaflet";
import { getResolvedTheme, subscribe as onThemeChange, type ResolvedTheme } from "../../lib/theme";

// Basemap compartido por el mapa de agentes (RobotMap) y el editor de
// ubicación (LocationEditor). CARTO discontinuó el acceso anónimo a sus tiles
// (los servía con marca de agua "API KEY REQUIRED"), así que el default pasó
// a ser el basemap oscuro keyless de Esri (capa base + capa de etiquetas).
// Para un proveedor con plan pago y tema propio (Stadia, CARTO, MapTiler)
// alcanza con setear VITE_MAP_TILE_URL (y opcionalmente VITE_MAP_TILE_ATTRIBUTION)
// en el .env del despliegue — mismo patrón que el resto de las VITE_*. Ese
// proveedor tiene un solo estilo: si se quiere uno distinto para el tema claro,
// VITE_MAP_TILE_URL_LIGHT (si no se define, se usa el mismo en ambos temas).
const CUSTOM_TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim();
const CUSTOM_TILE_ATTRIBUTION = (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim();
const CUSTOM_TILE_URL_LIGHT = (import.meta.env.VITE_MAP_TILE_URL_LIGHT as string | undefined)?.trim();
const ESRI_DARK_BASE = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ESRI_DARK_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ESRI_LIGHT_BASE = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ESRI_LIGHT_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "&copy; <a href=\"https://www.esri.com/\">Esri</a>";
const ESRI_MAX_ZOOM = 16;

/** maxZoom del mapa: el de Esri llega a 16; un proveedor propio suele soportar 20. */
export const MAP_MAX_ZOOM = CUSTOM_TILE_URL ? 20 : ESRI_MAX_ZOOM;

function addTiles(group: L.LayerGroup, theme: ResolvedTheme): void {
  if (CUSTOM_TILE_URL) {
    const url = theme === "light" ? CUSTOM_TILE_URL_LIGHT || CUSTOM_TILE_URL : CUSTOM_TILE_URL;
    L.tileLayer(url, { attribution: CUSTOM_TILE_ATTRIBUTION ?? "", maxZoom: 20 }).addTo(group);
    return;
  }
  const [base, labels] = theme === "light" ? [ESRI_LIGHT_BASE, ESRI_LIGHT_LABELS] : [ESRI_DARK_BASE, ESRI_DARK_LABELS];
  L.tileLayer(base, { attribution: ESRI_ATTRIBUTION, maxZoom: ESRI_MAX_ZOOM }).addTo(group);
  L.tileLayer(labels, { maxZoom: ESRI_MAX_ZOOM }).addTo(group);
}

/** Pone el basemap del tema actual y lo cambia solo si el tema cambia; se desuscribe al destruir el mapa. */
export function addBasemap(map: L.Map): void {
  const group = L.layerGroup().addTo(map);
  let shown = getResolvedTheme();
  addTiles(group, shown);
  const unsubscribe = onThemeChange(() => {
    if (getResolvedTheme() === shown) return;
    shown = getResolvedTheme();
    group.clearLayers();
    addTiles(group, shown);
  });
  map.on("unload", unsubscribe);
}
