import L from "leaflet";
import { useEffect, useRef } from "react";
import { ROBOTS } from "../../data/mockEvents";
import type { RobotStatus } from "../../types";

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
}

export function RobotMap({ active }: RobotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!active || mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([40.2, -3.5], 5.3);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OSM &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);

    ROBOTS.forEach((r) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="marker-dot ${r.status}"></div>`,
        iconSize: [15, 15],
        iconAnchor: [7, 7],
      });
      L.marker([r.lat, r.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div class="map-popup-title">${r.name}</div>
           <div class="map-popup-meta">${r.store} · ${r.city}</div>
           <span class="map-popup-badge" style="background:${STATUS_BG[r.status]};color:${STATUS_FG[r.status]}">${STATUS_LABEL[r.status]} · ${r.meta}</span>`
        );
    });

    mapRef.current = map;
  }, [active]);

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
