import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Robot, RobotStatus } from "../../types";

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
      map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([40.2, -3.5], 6);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OSM &copy; CARTO",
        maxZoom: 19,
      }).addTo(map);
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
