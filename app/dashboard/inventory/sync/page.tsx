'use client';

import { LegacyRedirect } from '@/components/inventory/InventoryShell';

/** Consolidated into Transfers (container tab) */
export default function SyncRedirect() {
  return <LegacyRedirect to="/dashboard/inventory/stock-transfers?tab=container" />;
}
