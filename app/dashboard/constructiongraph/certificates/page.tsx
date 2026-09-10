'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphCertificatesPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');

  const add = async () => {
    const nextNo = number.trim();
    if (!nextNo) {
      toast.error('Certificate number is required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        certificates: [
          {
            id: `cert_${Date.now()}`,
            number: nextNo,
            certified_amount: amount ? Number(amount) : null,
            status: 'draft',
            site_id: store?.sites[0]?.id || null,
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
      description="Interim payment certificates and retention. Invoices stay on Customers Trade."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-3 gap-2">
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
              {store.certificates.map((row) => (
                <div key={row.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                  <b>{row.number}</b> · {row.status}
                  {row.certified_amount != null
                    ? ` · R ${Number(row.certified_amount).toLocaleString('en-ZA')}`
                    : ''}
                  {row.retention != null
                    ? ` · retention R ${Number(row.retention).toLocaleString('en-ZA')}`
                    : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
