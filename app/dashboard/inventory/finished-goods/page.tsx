'use client';

import { LegacyRedirect } from '@/components/inventory/InventoryShell';

/** Consolidated into Products (type = finished_good) */
export default function FinishedGoodsRedirect() {
  return <LegacyRedirect to="/dashboard/inventory/stock?type=finished_good" />;
}
