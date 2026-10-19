import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { truckIcon } from "@/lib/leaflet";
import { relative } from "@/lib/format";

/** Centre la carte sur la dernière position connue du chauffeur. */
function Recenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, Math.max(map.getZoom(), 13));
  }, [map, position]);
  return null;
}

/**
 * Carte de suivi d'une livraison en cours : position temps réel du
 * chauffeur (GPS envoyé depuis son espace).
 */
export function CommandeMap({
  latitude,
  longitude,
  majLe,
  label = "Position du chauffeur",
  height = "h-72",
}: {
  latitude: number;
  longitude: number;
  majLe?: string | null;
  label?: string;
  height?: string;
}) {
  const position: [number, number] = [latitude, longitude];

  return (
    // `isolate` crée un contexte d'empilement : les z-index internes de
    // Leaflet (contrôles ≈ 1000) ne passent plus au-dessus des modales.
    <div className={`${height} isolate overflow-hidden rounded-2xl border border-ge7-black/10`}>
      <MapContainer center={position} zoom={13} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <Recenter position={position} />
        <Marker position={position} icon={truckIcon}>
          <Popup>
            <p className="font-bold">{label}</p>
            {majLe && <p className="text-xs">Dernière position : {relative(majLe)}</p>}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
