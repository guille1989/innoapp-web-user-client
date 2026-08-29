import L from "leaflet";

// Basemap compartido por el mapa de agentes (RobotMap) y el editor de
// ubicación (LocationEditor). CARTO discontinuó el acceso anónimo a sus tiles
// (los servía con marca de agua "API KEY REQUIRED"), así que el default pasó
// a ser el basemap oscuro keyless de Esri (capa base + capa de etiquetas).
// Para un proveedor con plan pago y tema propio (Stadia, CARTO, MapTiler)
// alcanza con setear VITE_MAP_TILE_URL (y opcionalmente VITE_MAP_TILE_ATTRIBUTION)
// en el .env del despliegue — mismo patrón que el resto de las VITE_*.
const CUSTOM_TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim();
const CUSTOM_TILE_ATTRIBUTION = (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim();
const ESRI_DARK_BASE = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ESRI_DARK_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "&copy; <a href=\"https://www.esri.com/\">Esri</a>";
const ESRI_MAX_ZOOM = 16;

/** maxZoom del mapa: el de Esri llega a 16; un proveedor propio suele soportar 20. */
export const MAP_MAX_ZOOM = CUSTOM_TILE_URL ? 20 : ESRI_MAX_ZOOM;

export function addBasemap(map: L.Map): void {
  if (CUSTOM_TILE_URL) {
    L.tileLayer(CUSTOM_TILE_URL, { attribution: CUSTOM_TILE_ATTRIBUTION ?? "", maxZoom: 20 }).addTo(map);
    return;
  }
  L.tileLayer(ESRI_DARK_BASE, { attribution: ESRI_ATTRIBUTION, maxZoom: ESRI_MAX_ZOOM }).addTo(map);
  L.tileLayer(ESRI_DARK_LABELS, { maxZoom: ESRI_MAX_ZOOM }).addTo(map);
}
