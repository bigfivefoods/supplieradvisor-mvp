'use client';

import { LegacyRedirect } from '@/components/inventory/InventoryShell';

/** Consolidated into Counts (history tab) */
export default function CycleCountsRedirect() {
  return <LegacyRedirect to="/dashboard/inventory/counts?tab=history" />;
}
