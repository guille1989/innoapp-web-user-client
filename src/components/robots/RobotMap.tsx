import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Robot, RobotStatus } from "../../types";

// Basemap configurable por entorno. CARTO discontinuó el acceso anónimo a sus
// tiles (las servía con marca de agua "API KEY REQUIRED"), así que el default
// pasó a ser el basemap oscuro keyless de Esri (capa base + capa de etiquetas).
// Para un proveedor con plan pago y tema propio (Stadia, CARTO, MapTiler)
// alcanza con setear VITE_MAP_TILE_URL (y opcionalmente VITE_MAP_TILE_ATTRIBUTION)
// en el .env del despliegue — mismo patrón que el resto de las VITE_*.
const CUSTOM_TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim();
const CUSTOM_TILE_ATTRIBUTION = (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim();
const ESRI_DARK_BASE = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ESRI_DARK_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "&copy; <a href=\"https://www.esri.com/\">Esri</a>";
const ESRI_MAX_ZOOM = 16;
const MAP_MAX_ZOOM = CUSTOM_TILE_URL ? 20 : ESRI_MAX_ZOOM;

function addBasemap(map: L.Map) {
  if (CUSTOM_TILE_URL) {
    L.tileLayer(CUSTOM_TILE_URL, { attribution: CUSTOM_TILE_ATTRIBUTION ?? "", maxZoom: 20 }).addTo(map);
    return;
  }
  L.tileLayer(ESRI_DARK_BASE, { attribution: ESRI_ATTRIBUTION, maxZoom: ESRI_MAX_ZOOM }).addTo(map);
  L.tileLayer(ESRI_DARK_LABELS, { maxZoom: ESRI_MAX_ZOOM }).addTo(map);
}

const STATUS_LABEL: Record<RobotStatus, string> = { online: "online", warn: "reintentando", offline: "offline" };
const STATUS_BG: Record<RobotStatus, string> = {
  online: "var(--teal-dim)",
  warn: "var(--amber-dim)",
  offline: "rgba(140,147,163,.15)",
};
const STATUS_FG: Record<RobotStatus, string> = {
  online: "var(--teal)",
  warn: "var(--amber)",
  offline: "var(--text-dim)",
};

interface RobotMapProps {
  active: boolean;
  robots: Robot[];
}

function markerIcon(status: RobotStatus) {
  return L.divIcon({
    className: "",
    html: `<div class="marker-dot ${status}"></div>`,
    iconSize: [15, 15],
    iconAnchor: [7, 7],
  });
}

function popupContent(robot: Robot) {
  const popup = document.createElement("div");
  const title = document.createElement("div");
  title.className = "map-popup-title";
  title.textContent = robot.name;
  const meta = document.createElement("div");
  meta.className = "map-popup-meta";
  meta.textContent = `${robot.store} · ${robot.city}`;
  const badge = document.createElement("span");
  badge.className = "map-popup-badge";
  badge.style.background = STATUS_BG[robot.status];
  badge.style.color = STATUS_FG[robot.status];
  badge.textContent = `${STATUS_LABEL[robot.status]} · ${robot.meta}`;
  popup.append(title, meta, badge);
  return popup;
}

export function RobotMap({ active, robots }: RobotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!active || !containerRef.current) return;

    let map = mapRef.current;
    if (!map) {
      map = L.map(containerRef.current, { zoomControl: false, attributionControl: true, maxZoom: MAP_MAX_ZOOM }).setView([40.2, -3.5], 6);
      addBasemap(map);
      mapRef.current = map;
    }

    const visibleIds = new Set<string>();
    for (const robot of robots) {
      if (robot.lat === undefined || robot.lng === undefined) continue;
      visibleIds.add(robot.id);
      const marker = markersRef.current.get(robot.id);
      if (marker) {
        marker.setLatLng([robot.lat, robot.lng]);
        marker.setIcon(markerIcon(robot.status));
        marker.setPopupContent(popupContent(robot));
      } else {
        markersRef.current.set(
          robot.id,
          L.marker([robot.lat, robot.lng], { icon: markerIcon(robot.status) }).addTo(map).bindPopup(popupContent(robot)),
        );
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!visibleIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    const timer = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(timer);
  }, [active, robots]);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div className="robot-map" ref={containerRef} />;
}
