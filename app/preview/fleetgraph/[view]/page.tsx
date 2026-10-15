'use client';

import { useParams } from 'next/navigation';
import { PreviewShell, screenFromParam } from '@/components/fleet/PreviewShell';

export default function PreviewFleetViewPage() {
  const params = useParams<{ view: string }>();
  return <PreviewShell screen={screenFromParam(params.view)} />;
}
