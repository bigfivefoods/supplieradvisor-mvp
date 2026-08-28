'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { HireCompanyPin, LatLng } from '@/lib/hire/hire-search';

const LeafletHireMap = dynamic(() => import('./HireSearchLeafletMap'), {
  ssr: false,
});

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => GoogleMap;
        Marker: new (opts: Record<string, unknown>) => GoogleMarker;
        InfoWindow: new (opts: Record<string, unknown>) => GoogleInfo;
        LatLngBounds: new () => GoogleBounds;
        Size: new (w: number, h: number) => unknown;
        Point: new (x: number, y: number) => unknown;
      };
    };
  }
}

type GoogleApi = NonNullable<Window['google']>;

type GoogleMap = {
  fitBounds: (b: GoogleBounds, p?: number) => void;
  setCenter: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
};
type GoogleMarker = { setMap: (m: GoogleMap | null) => void; addListener: (e: string, fn: () => void) => void };
type GoogleInfo = { setContent: (h: string) => void; open: (opts: { map: GoogleMap; anchor: GoogleMarker }) => void; close: () => void };
type GoogleBounds = { extend: (c: { lat: number; lng: number }) => void };

function mapsKey() {
  return String(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ||
      ''
  ).trim();
}

let mapsPromise: Promise<GoogleApi> | null = null;

function loadGoogleMaps(): Promise<GoogleApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if (window.google?.maps) return Promise.resolve(window.google);
  const key = mapsKey();
  if (!key) return Promise.reject(new Error('no-key'));
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const ready = () => {
      const g = window.google;
      if (g?.maps) resolve(g);
      else reject(new Error('maps'));
    };
    const existing = document.getElementById('sa-google-maps');
    if (existing) {
      existing.addEventListener('load', ready);
      existing.addEventListener('error', () => reject(new Error('maps')));
      return;
    }
    const s = document.createElement('script');
    s.id = 'sa-google-maps';
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    s.onload = ready;
    s.onerror = () => reject(new Error('maps'));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

function pinLabel(pin: HireCompanyPin) {
  const n = pin.item_count;
  const rate =
    pin.min_rate_zar != null
      ? ` from R${Math.round(pin.min_rate_zar).toLocaleString('en-ZA')}`
      : '';
  return `${pin.name} · ${n} item${n === 1 ? '' : 's'}${rate}`;
}

function GoogleHireMap({
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
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps()
      .then((g) => {
        const host = el.current;
        if (cancelled || !host || !g?.maps) return;
        if (!mapRef.current) {
          mapRef.current = new g.maps.Map(host, {
            center: { lat: center[0], lng: center[1] },
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });
        }
        const map = mapRef.current;
        for (const m of markersRef.current) m.setMap(null);
        markersRef.current = [];
        const bounds = new g.maps.LatLngBounds();
        const info = new g.maps.InfoWindow({});
        for (const pin of pins) {
          const pos = { lat: pin.position[0], lng: pin.position[1] };
          bounds.extend(pos);
          const marker = new g.maps.Marker({
            map,
            position: pos,
            title: pinLabel(pin),
            label:
              pin.min_rate_zar != null
                ? {
                    text: `R${Math.round(pin.min_rate_zar / 100) * 100}+`,
                    color: '#0f172a',
                    fontSize: '11px',
                    fontWeight: '800',
                  }
                : undefined,
          });
          marker.addListener('click', () => {
            info.setContent(
              `<div style="font:600 13px system-ui,sans-serif;color:#0f172a;max-width:220px">
                <div style="font-weight:800">${pin.name}</div>
                <div style="font-size:12px;color:#475569;margin-top:2px">${pin.location || ''}</div>
                <div style="font-size:12px;margin-top:4px">${pin.item_count} item${pin.item_count === 1 ? '' : 's'} to hire</div>
              </div>`
            );
            info.open({ map, anchor: marker });
            onPinClick(pin.key);
          });
          markersRef.current.push(marker);
        }
        if (userLocation) {
          bounds.extend(userLocation);
          const you = new g.maps.Marker({
            map,
            position: userLocation,
            title: 'You',
          });
          markersRef.current.push(you);
        }
        if (pins.length > 1) map.fitBounds(bounds, 48);
        else if (pins.length === 1 && pins[0]) {
          map.setCenter({ lat: pins[0].position[0], lng: pins[0].position[1] });
          map.setZoom(13);
        } else {
          map.setCenter({ lat: center[0], lng: center[1] });
          map.setZoom(zoom);
        }
        void activeKey;
      })
      .catch(() => {
        /* leaflet fallback handled by parent */
      });
    return () => {
      cancelled = true;
    };
  }, [pins, center, zoom, userLocation, activeKey, onPinClick]);

  return (
    <div
      ref={el}
      className="h-full w-full overflow-hidden rounded-2xl"
      style={{ minHeight: height }}
    />
  );
}

export function HireSearchMap(props: {
  pins: HireCompanyPin[];
  center: [number, number];
  zoom?: number;
  userLocation: LatLng | null;
  activeKey: string | null;
  onPinClick: (key: string) => void;
  height?: string;
}) {
  const [mode, setMode] = useState<'google' | 'leaflet'>(() =>
    mapsKey() ? 'google' : 'leaflet'
  );
  const height = props.height || '320px';

  useEffect(() => {
    if (!mapsKey()) return;
    void loadGoogleMaps().catch(() => setMode('leaflet'));
  }, []);

  if (mode === 'google' && mapsKey()) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ height }}>
        <GoogleHireMap {...props} zoom={props.zoom || 12} height={height} />
      </div>
    );
  }

  return (
    <LeafletHireMap
      pins={props.pins}
      center={props.center}
      zoom={props.zoom || 12}
      userLocation={props.userLocation}
      activeKey={props.activeKey}
      onPinClick={props.onPinClick}
      height={height}
    />
  );
}
