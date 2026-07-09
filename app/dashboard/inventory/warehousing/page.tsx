'use client';

import { LegacyRedirect } from '@/components/inventory/InventoryShell';

/** Consolidated into Locations (warehouses) */
export default function WarehousingRedirect() {
  return <LegacyRedirect to="/dashboard/inventory/warehouses" />;
}
