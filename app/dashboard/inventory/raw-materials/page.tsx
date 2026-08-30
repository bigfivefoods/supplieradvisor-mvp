'use client';

import { LegacyRedirect } from '@/components/inventory/InventoryShell';

/** Consolidated into Products (type = raw_material) */
export default function RawMaterialsRedirect() {
  return <LegacyRedirect to="/dashboard/inventory/stock?type=raw_material" />;
}
