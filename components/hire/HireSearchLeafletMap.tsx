'use client';

import { useEffect } from 'react';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HireCompanyPin, LatLng } from '@/lib/hire/hire-search';

function pillIcon(label: string, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      transform:translate(-50%,-100%);
      background:${active ? '#0e7490' : '#fff'};
      color:${active ? '#fff' : '#0f172a'};
      border:1px solid ${active ? '#0e7490' : '#cbd5e1'};
      border-radius:999px;
      padding:4px 8px;
      font:800 11px system-ui,sans-serif;
      box-shadow:0 6px 16px rgba(15,23,42,.16);
      white-space:nowrap;
    ">${label}</div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 8],
  });
}

function youIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;border-radius:99px;
      background:#2563eb;border:3px solid #fff;
      box-shadow:0 0 0 6px rgba(37,99,235,.25);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function Fit({
  pins,
  userLocation,
  center,
  zoom,
}: {
  pins: HireCompanyPin[];
  userLocation: LatLng | null;
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = pins.map((p) => p.position);
    if (userLocation) pts.push([userLocation.lat, userLocation.lng]);
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts).pad(0.25));
      return;
    }
    if (pts.length === 1 && pts[0]) {
      map.setView(pts[0], 13);
      return;
    }
    map.setView(center, zoom);
  }, [pins, userLocation, center, zoom, map]);
  return null;
}

function Invalidate() {
  const map = useMap();
  useEffect(() => {
    const run = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* disposed */
      }
    };
    run();
    const t = window.setTimeout(run, 200);
    return () => window.clearTimeout(t);
  }, [map]);
  return null;
}

export default function HireSearchLeafletMap({
  pins,
  center,
  zoom,
  userLocation,
  activeKey,
  onPinClick,
  height,
}: {
  pins: HireCompanyPin[];
  center: [number, number];
  zoom: number;
  userLocation: LatLng | null;
  activeKey: string | null;
  onPinClick: (key: string) => void;
  height: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        className="!z-0"
      >
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          attribution="© Google"
        />
        <Invalidate />
        <Fit
          pins={pins}
          userLocation={userLocation}
          center={center}
          zoom={zoom}
        />
        {userLocation ? (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={youIcon()}
          >
            <Popup>You are here</Popup>
          </Marker>
        ) : null}
        {pins.map((pin) => {
          const rate =
            pin.min_rate_zar != null
              ? `R${Math.round(pin.min_rate_zar).toLocaleString('en-ZA')}+`
              : `${pin.item_count}`;
          return (
            <Marker
              key={pin.key}
              position={pin.position}
              icon={pillIcon(rate, activeKey === pin.key)}
              eventHandlers={{ click: () => onPinClick(pin.key) }}
            >
              <Popup>
                <div className="text-sm font-black text-slate-900">{pin.name}</div>
                {pin.location ? (
                  <div className="text-xs text-slate-600">{pin.location}</div>
                ) : null}
                <div className="mt-1 text-xs text-slate-700">
                  {pin.item_count} item{pin.item_count === 1 ? '' : 's'} to hire
                </div>
                <a
                  className="mt-1 inline-block text-[11px] font-bold text-cyan-800"
                  href={`https://www.google.com/maps/search/?api=1&query=${pin.position[0]},${pin.position[1]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
