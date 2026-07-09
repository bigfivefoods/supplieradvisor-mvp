'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { LeafletMouseEvent } from 'leaflet';

// Fix default marker icons in bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export type MapPin = {
  id: string | number;
  position: [number, number];
  label?: string;
  subtitle?: string;
};

interface LocationMapProps {
  onMapClick?: (lat: number, lng: number) => void;
  selectedPosition?: [number, number] | null;
  layer?: 'street' | 'satellite';
  pins?: MapPin[];
  center?: [number, number];
  zoom?: number;
  className?: string;
  height?: string;
  interactive?: boolean;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) return;
    if (pins.length === 1) {
      map.setView(pins[0].position, 12);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => p.position));
    map.fitBounds(bounds.pad(0.2));
  }, [pins, map]);
  return null;
}

export default function LocationMap({
  onMapClick,
  selectedPosition,
  layer = 'street',
  pins = [],
  center,
  zoom = 5,
  height = '100%',
  interactive = true,
}: LocationMapProps) {
  const defaultCenter: [number, number] = center || selectedPosition || [-29.0, 24.5];
  const tileUrl =
    layer === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution =
    layer === 'satellite'
      ? 'Tiles &copy; Esri'
      : '&copy; OpenStreetMap contributors';

  return (
    <MapContainer
      center={defaultCenter}
      zoom={zoom}
      style={{ height, width: '100%', borderRadius: 24 }}
      scrollWheelZoom={interactive}
      dragging={interactive}
    >
      <TileLayer url={tileUrl} attribution={attribution} />
      {onMapClick && interactive && <MapClickHandler onMapClick={onMapClick} />}
      {selectedPosition && (
        <>
          <Marker position={selectedPosition} />
          <Recenter center={selectedPosition} zoom={Math.max(zoom, 11)} />
        </>
      )}
      {pins.map((pin) => (
        <Marker key={String(pin.id)} position={pin.position}>
          {(pin.label || pin.subtitle) && (
            <Popup>
              <div className="text-sm font-semibold">{pin.label}</div>
              {pin.subtitle && <div className="text-xs text-slate-600">{pin.subtitle}</div>}
            </Popup>
          )}
        </Marker>
      ))}
      {!selectedPosition && pins.length > 0 && <FitBounds pins={pins} />}
    </MapContainer>
  );
}
