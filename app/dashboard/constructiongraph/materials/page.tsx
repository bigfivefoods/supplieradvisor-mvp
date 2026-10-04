'use client';

import Link from 'next/link';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphMaterialsPage() {
  const { store, loading } = useConstructiongraph();
  return (
    <ConstructiongraphWorkbench
      title="Materials"
      description="Site materials and plant. Purchase orders and stock lots stay on Core Inventory and Suppliers."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="grid lg:grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-stone-300 bg-white p-4">
            <h3 className="font-black mb-2">Materials ({store.materials.length})</h3>
            {store.materials.length === 0 ? (
              <ConstructionEmptyHint>No material deliveries logged.</ConstructionEmptyHint>
            ) : (
              store.materials.map((row) => {
                const site = store.sites.find((s) => s.id === row.site_id);
                return (
                  <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                    {row.item} · {row.delivered_qty ?? 0}/{row.ordered_qty} {row.uom} · PO{' '}
                    {row.po_number || '—'}
                    {site ? ` · ${site.code}` : ''}
                  </div>
                );
              })
            )}
            <div className="mt-3">
              <Link href="/dashboard/suppliers/po" className="text-amber-800 underline">
                Supplier POs
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-stone-300 bg-white p-4">
            <h3 className="font-black mb-2">Plant ({store.plant.length})</h3>
            {store.plant.length === 0 ? (
              <ConstructionEmptyHint>No plant on site.</ConstructionEmptyHint>
            ) : (
              store.plant.map((row) => {
                const site = store.sites.find((s) => s.id === row.site_id);
                return (
                  <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                    {row.plant_no} · {row.description} · {row.status}
                    {row.hired ? ' · hired' : ''}
                    {site ? ` · ${site.code}` : ''}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
