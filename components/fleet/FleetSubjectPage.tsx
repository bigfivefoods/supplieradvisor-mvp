'use client';

import { useParams } from 'next/navigation';
import { FleetLive } from './FleetLive';

export function FleetSubjectPage({ screen }: { screen: 'vehicle' | 'driver' }) {
  const params = useParams<{ id: string }>();
  return <FleetLive screen={screen} subjectId={String(params.id || '')} />;
}
