'use client';

import { useParams } from 'next/navigation';
import { ConstructionTokenApp } from '@/app/construction/[token]/page';

export default function CrewConstructionPage() {
  const params = useParams<{ token: string }>();
  return <ConstructionTokenApp token={String(params?.token || '')} expect="contractor" />;
}
