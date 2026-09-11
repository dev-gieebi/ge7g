import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

export const truckIcon = L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#6a3fd1;border:3px solid #f3d27a;box-shadow:0 6px 16px rgba(0,0,0,.35);display:grid;place-items:center;color:#fff;font-size:18px">🚚</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export const siteIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:10px;background:#c9a227;border:3px solid #151515;box-shadow:0 6px 16px rgba(0,0,0,.35);display:grid;place-items:center;font-size:16px">🏗️</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});
