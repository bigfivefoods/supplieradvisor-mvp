'use client';

import { useParams } from 'next/navigation';
import { PreviewShell } from '@/components/fleet/PreviewShell';

export default function PreviewVehiclePage() {
  const params = useParams<{ id: string }>();
  return <PreviewShell screen="vehicle" subjectId={String(params.id || '')} />;
}
