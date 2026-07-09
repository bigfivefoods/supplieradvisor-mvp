'use client';

import { LegacyRedirect } from '@/components/inventory/InventoryShell';

/** Consolidated into Counts */
export default function StockTakeRedirect() {
  return <LegacyRedirect to="/dashboard/inventory/counts" />;
}
