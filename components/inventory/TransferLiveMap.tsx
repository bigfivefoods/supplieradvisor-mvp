'use client';

import { Fragment, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Point = { lat: number; lng: number };
type TransferPin = {
  id: number;
  transfer_number?: string | null;
  status: string;
  driver_name?: string | null;
  to_warehouse_name?: string | null;
  current?: Point | null;
  dest?: Point | null;
  origin?: Point | null;
  trail?: Point[];
  eta_label?: string;
};

// Fix default marker icons in bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const truckIcon = new L.DivIcon({
  className: '',
  html: `<div style="background:#00b4d8;color:white;border-radius:999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25)">🚚</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function FitBounds({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11);
      return;
    }
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(b, { padding: [40, 40], maxZoom: 12 });
    setTimeout(() => map.invalidateSize(), 100);
  }, [map, points]);
  return null;
}

export default function TransferLiveMap({ transfers }: { transfers: TransferPin[] }) {
  const allPoints = useMemo(() => {
    const pts: Point[] = [];
    for (const t of transfers) {
      if (t.current) pts.push(t.current);
      if (t.dest) pts.push(t.dest);
      if (t.origin) pts.push(t.origin);
      for (const p of t.trail || []) pts.push(p);
    }
    return pts;
  }, [transfers]);

  const center: [number, number] = allPoints.length
    ? [allPoints[0].lat, allPoints[0].lng]
    : [-26.2, 28.0];

  if (!transfers.length) {
    return (
      <div className="h-[360px] rounded-3xl border bg-neutral-50 flex items-center justify-center text-sm text-neutral-500">
        No live positions yet — drivers need GPS on pickup / en route.
      </div>
    );
  }

  return (
    <div className="h-[380px] sm:h-[440px] rounded-3xl overflow-hidden border border-neutral-200 shadow-sm z-0 relative">
      <MapContainer
        center={center}
        zoom={7}
        className="h-full w-full"
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />

        {transfers.map((t) => (
          <Fragment key={t.id}>
            {t.trail && t.trail.length > 1 && (
              <Polyline
                positions={t.trail.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: '#0077b6', weight: 3, opacity: 0.7 }}
              />
            )}
            {t.origin && (
              <CircleMarker
                center={[t.origin.lat, t.origin.lng]}
                radius={7}
                pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9 }}
              >
                <Popup>
                  Origin · {t.transfer_number}
                </Popup>
              </CircleMarker>
            )}
            {t.dest && (
              <CircleMarker
                center={[t.dest.lat, t.dest.lng]}
                radius={8}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.9 }}
              >
                <Popup>
                  Destination: {t.to_warehouse_name || '—'}
                  <br />
                  {t.transfer_number}
                </Popup>
              </CircleMarker>
            )}
            {t.current && (
              <Marker position={[t.current.lat, t.current.lng]} icon={truckIcon}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold font-mono">{t.transfer_number}</div>
                    <div className="capitalize">{t.status.replace(/_/g, ' ')}</div>
                    {t.driver_name && <div>Driver: {t.driver_name}</div>}
                    {t.to_warehouse_name && <div>→ {t.to_warehouse_name}</div>}
                    {t.eta_label && <div className="font-semibold text-[#0077b6]">ETA {t.eta_label}</div>}
                  </div>
                </Popup>
              </Marker>
            )}
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
