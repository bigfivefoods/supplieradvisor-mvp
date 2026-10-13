'use client';

import dynamic from 'next/dynamic';

const PoDesk = dynamic(() => import('./PoDesk'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00b4d8] border-t-transparent" />
    </div>
  ),
});

export default function SupplierPoPage() {
  return <PoDesk />;
}
