import L from "leaflet";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AgentLocation } from "../../api/client";
import type { Robot } from "../../types";

interface LocationEditorProps {
  robot: Robot;
  onClose: () => void;
  onSave: (agentId: string, location: AgentLocation) => Promise<void>;
}

export function LocationEditor({ robot, onClose, onSave }: LocationEditorProps) {
  const [label, setLabel] = useState(robot.store === "Ubicación sin configurar" ? "" : robot.store);
  const [city, setCity] = useState(robot.city);
  const [lat, setLat] = useState<number | undefined>(robot.lat);
  const [lng, setLng] = useState<number | undefined>(robot.lng);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapElement.current) return;
    const center: L.LatLngExpression = lat !== undefined && lng !== undefined ? [lat, lng] : [40.2, -3.5];
    const map = L.map(mapElement.current, { zoomControl: true }).setView(center, lat === undefined ? 6 : 15);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: "&copy; OSM &copy; CARTO", maxZoom: 19 }).addTo(map);

    const placeMarker = (nextLat: number, nextLng: number) => {
      if (markerRef.current) markerRef.current.setLatLng([nextLat, nextLng]);
      else markerRef.current = L.marker([nextLat, nextLng]).addTo(map);
    };
    if (lat !== undefined && lng !== undefined) placeMarker(lat, lng);
    map.on("click", ({ latlng }) => {
      setLat(latlng.lat);
      setLng(latlng.lng);
      placeMarker(latlng.lat, latlng.lng);
    });
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  // El mapa se crea una sola vez para esta sesión del editor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useCurrentLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Este navegador no permite obtener la ubicación.");
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLat(coords.latitude);
      setLng(coords.longitude);
      mapRef.current?.setView([coords.latitude, coords.longitude], 16);
      if (markerRef.current) markerRef.current.setLatLng([coords.latitude, coords.longitude]);
      else if (mapRef.current) markerRef.current = L.marker([coords.latitude, coords.longitude]).addTo(mapRef.current);
    }, () => setError("No se pudo obtener la ubicación. Puedes seleccionar el punto en el mapa."), { enableHighAccuracy: true, timeout: 10_000 });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lat === undefined || lng === undefined) {
      setError("Selecciona un punto en el mapa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(robot.id, { label: label.trim(), city: city.trim(), lat, lng });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="location-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="location-editor glass" onSubmit={(event) => void submit(event)}>
        <header><div><span>Ubicación del agente</span><h2>{robot.name}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></header>
        <div className="location-fields">
          <label>Establecimiento<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} required placeholder="Ej. Restaurante Centro" /></label>
          <label>Ciudad<input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} required placeholder="Ej. Madrid" /></label>
        </div>
        <div className="location-map" ref={mapElement} />
        <div className="location-coordinates"><span>{lat === undefined ? "Selecciona el punto exacto en el mapa" : `${lat.toFixed(6)}, ${lng!.toFixed(6)}`}</span><button type="button" onClick={useCurrentLocation}>Usar mi ubicación</button></div>
        {error && <div className="location-error" role="alert">{error}</div>}
        <button className="location-save" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar ubicación"}</button>
      </form>
    </div>
  );
}
