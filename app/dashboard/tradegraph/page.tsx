'use client';

import { TradeDeskApp } from '@/components/trades/TradeDeskApp';

export default function TradegraphCommandPage() {
  return <TradeDeskApp live base="/dashboard/tradegraph" view="home" />;
}
