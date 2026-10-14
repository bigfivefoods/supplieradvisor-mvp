'use client';

import { TradeDeskApp } from '@/components/trades/TradeDeskApp';

export default function Page() {
  return <TradeDeskApp live base="/dashboard/tradegraph" view="materials" />;
}
