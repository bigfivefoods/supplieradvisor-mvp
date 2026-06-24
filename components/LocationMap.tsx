'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationMapProps {
  onMapClick: (lat: number, lng: number) => void;
  selectedPosition: [number, number] | null;
  layer: 'street' | 'satellite';
}

export default function LocationMap({ onMapClick, selectedPosition, layer }: LocationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-28.4793, 24.6727], // Centered on South Africa
      zoom: 5,
    });

    mapRef.current = map;

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    tileLayerRef.current = streetLayer;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current = marker;

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onMapClick(pos.lat, pos.lng);
        });
      }
    });

    return () => {
      map.remove();
    };
  }, [onMapClick]);

  // Switch between Street and Satellite
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    const map = mapRef.current;
    map.removeLayer(tileLayerRef.current);

    const newLayer = layer === 'satellite'
      ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri',
        })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [layer]);

  // Update marker when position changes
  useEffect(() => {
    if (!mapRef.current || !selectedPosition) return;

    const map = mapRef.current;

    if (markerRef.current) {
      markerRef.current.setLatLng(selectedPosition);
    } else {
      const marker = L.marker(selectedPosition, { draggable: true }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onMapClick(pos.lat, pos.lng);
      });
    }

    map.flyTo(selectedPosition, 14, { duration: 1.2 });
  }, [selectedPosition, onMapClick]);

  return <div ref={containerRef} className="w-full h-full rounded-3xl" style={{ minHeight: '380px' }} />;
}