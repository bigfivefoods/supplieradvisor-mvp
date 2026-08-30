'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import InvoiceWorkspace from '@/components/accounting/InvoiceWorkspace';

export default function AccountsPayablePage() {
  return (
    <Suspense fallback={null}>
      <PayableInner />
    </Suspense>
  );
}

function PayableInner() {
  const sp = useSearchParams();
  const fromPo = Number(sp.get('fromPo') || 0) || null;
  return (
    <InvoiceWorkspace
      direction="payable"
      title="Accounts"
      titleAccent="payable"
      description="Supplier bills, credit notes, and payment runs — track what you owe and clear it cleanly."
      fromPoId={fromPo}
    />
  );
}
