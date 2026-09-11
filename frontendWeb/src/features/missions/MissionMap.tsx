import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Mission } from "@/types";
import { siteIcon, truckIcon } from "@/lib/leaflet";
import { relative } from "@/lib/format";

const DEFAULT_CENTER: [number, number] = [14.6928, -17.4467];

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export function MissionMap({ missions, height = "h-[520px]" }: { missions: Mission[]; height?: string }) {
  const points: [number, number][] = [];
  missions.forEach((m) => {
    if (m.last_location) points.push([m.last_location.latitude, m.last_location.longitude]);
    const c = m.order?.chantier;
    if (c?.latitude && c?.longitude) points.push([c.latitude, c.longitude]);
  });

  return (
    <div className={`${height} overflow-hidden rounded-3xl border border-ge7-black/5 shadow-soft`}>
      <MapContainer center={points[0] ?? DEFAULT_CENTER} zoom={12} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <FitBounds points={points} />
        {missions.map((m) => {
          const c = m.order?.chantier;
          const track = (m.locations ?? []).map((l) => [l.latitude, l.longitude] as [number, number]);
          return (
            <div key={m.id}>
              {track.length > 1 && <Polyline positions={track} pathOptions={{ color: "#6a3fd1", weight: 4, opacity: 0.7 }} />}
              {m.last_location && (
                <Marker position={[m.last_location.latitude, m.last_location.longitude]} icon={truckIcon}>
                  <Popup>
                    <p className="font-bold">{m.number}</p>
                    <p>{m.driver?.name}</p>
                    <p className="text-xs">Dernière position : {relative(m.last_location.recorded_at)}</p>
                  </Popup>
                </Marker>
              )}
              {c?.latitude && c?.longitude && (
                <Marker position={[c.latitude, c.longitude]} icon={siteIcon}>
                  <Popup>
                    <p className="font-bold">{c.name}</p>
                    <p className="text-xs">{c.address}</p>
                  </Popup>
                </Marker>
              )}
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
