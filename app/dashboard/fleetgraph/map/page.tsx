import { FleetLive } from '@/components/fleet/FleetLive';

export const metadata = { title: 'FleetAdvisor® fleet map' };

export default function FleetMapPage() {
  return <FleetLive screen="map" />;
}
