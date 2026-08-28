'use client';

import dynamic from 'next/dynamic';

const PoDesk = dynamic(() => import('./PoDesk'), {
  ssr: false,
  loading: () => (
    <div className="p-10 text-sm text-neutral-500">Loading purchase orders…</div>
  ),
});

export default function SupplierPoPage() {
  return <PoDesk />;
}
