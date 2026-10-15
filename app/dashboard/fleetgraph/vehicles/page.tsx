import { FleetLive } from '@/components/fleet/FleetLive';

export const metadata = { title: 'FleetAdvisor® vehicles' };

export default function FleetVehiclesPage() {
  return <FleetLive screen="vehicles" />;
}
