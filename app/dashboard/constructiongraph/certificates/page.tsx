'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructionProjectSelect,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';
import { newConstructionId } from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphCertificatesPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [siteId, setSiteId] = useState('');
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');

  const add = async () => {
    const nextNo = number.trim();
    if (!nextNo) {
      toast.error('Certificate number is required');
      return;
    }
    const certified = amount ? Number(amount) : null;
    await post({
      action: 'merge',
      store: {
        certificates: [
          {
            id: newConstructionId('cert'),
            number: nextNo,
            certified_amount: certified,
            retention: certified != null ? Math.round(certified * 0.1) : null,
            status: 'draft',
            issued_at: new Date().toISOString().slice(0, 10),
            site_id: siteId || store?.sites[0]?.id || null,
            period: new Date().toISOString().slice(0, 7),
          },
        ],
      },
    });
    setNumber('');
    setAmount('');
    toast.success('Payment certificate saved');
  };

  return (
    <ConstructiongraphWorkbench
      title="Certificates"
      description="Interim payment certificates issued from the progress-payment plan. Date claims and client receipts on Payments. Invoices stay on Customers Trade."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm">
            Date the claim, certify it, and record the client payment on{' '}
            <Link
              href="/dashboard/constructiongraph/payments"
              className="text-amber-800 underline"
            >
              Payments
            </Link>
            . This desk keeps the IPC documents.
          </div>
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-4 gap-2">
            <ConstructionProjectSelect
              store={store}
              value={siteId}
              onChange={setSiteId}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="IPC-03"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Certified amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add certificate
            </button>
          </div>
          {store.certificates.length === 0 ? (
            <ConstructionEmptyHint>No payment certificates yet.</ConstructionEmptyHint>
          ) : (
            <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2">
              {store.certificates.map((row) => {
                const site = store.sites.find((s) => s.id === row.site_id);
                const payment = store.payments.find((p) => p.certificate_id === row.id);
                return (
                  <div key={row.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                    <b>{row.number}</b> · {row.status}
                    {site ? ` · ${site.code}` : ''}
                    {row.certified_amount != null ? ` · ${zar(row.certified_amount)}` : ''}
                    {row.retention != null ? ` · retention ${zar(row.retention)}` : ''}
                    {row.paid_at ? ` · paid ${row.paid_at}` : ''}
                    {payment ? ` · plan ${payment.number}` : ''}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
