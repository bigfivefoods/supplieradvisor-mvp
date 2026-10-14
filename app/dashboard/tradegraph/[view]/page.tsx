'use client';

import { useParams } from 'next/navigation';
import { TradeDeskApp } from '@/components/trades/TradeDeskApp';

export default function TradeViewPage() {
  const params = useParams<{ view: string }>();
  return <TradeDeskApp live base="/dashboard/tradegraph" view={params.view || 'home'} />;
}
