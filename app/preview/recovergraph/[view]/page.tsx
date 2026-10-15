'use client';

import { useParams } from 'next/navigation';
import { PreviewDesk } from '@/components/recovery/PreviewDesk';

export default function PreviewRecoverViewPage() {
  const params = useParams<{ view: string }>();
  return <PreviewDesk view={String(params?.view || '')} />;
}
