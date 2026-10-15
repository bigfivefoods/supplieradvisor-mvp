'use client';

import { useParams } from 'next/navigation';
import { PreviewDesk } from '@/components/construction/PreviewApp';

export default function PreviewConstructionViewPage() {
  const params = useParams<{ view: string }>();
  return <PreviewDesk view={String(params?.view || '')} />;
}
