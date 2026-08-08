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

export function RobotMap({ active, robots }: RobotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    mapRef.current?.remove();
    mapRef.current = null;

    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([40.2, -3.5], 5.3);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OSM &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);

    robots.forEach((r) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="marker-dot ${r.status}"></div>`,
        iconSize: [15, 15],
        iconAnchor: [7, 7],
      });
      const popup = document.createElement("div");
      const title = document.createElement("div");
      title.className = "map-popup-title";
      title.textContent = r.name;
      const meta = document.createElement("div");
      meta.className = "map-popup-meta";
      meta.textContent = `${r.store} · ${r.city}`;
      const badge = document.createElement("span");
      badge.className = "map-popup-badge";
      badge.style.background = STATUS_BG[r.status];
      badge.style.color = STATUS_FG[r.status];
      badge.textContent = `${STATUS_LABEL[r.status]} · ${r.meta}`;
      popup.append(title, meta, badge);
      L.marker([r.lat, r.lng], { icon }).addTo(map).bindPopup(popup);
    });

    mapRef.current = map;
  }, [active, robots]);

  useEffect(() => {
    if (active && mapRef.current) {
      const t = setTimeout(() => mapRef.current?.invalidateSize(), 60);
      return () => clearTimeout(t);
    }
  }, [active]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div className="robot-map" ref={containerRef} />;
}
