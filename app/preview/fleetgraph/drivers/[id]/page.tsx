'use client';

import { useParams } from 'next/navigation';
import { PreviewShell } from '@/components/fleet/PreviewShell';

export default function PreviewDriverPage() {
  const params = useParams<{ id: string }>();
  return <PreviewShell screen="driver" subjectId={String(params.id || '')} />;
}
