'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowLeft, Loader2, PackagePlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import type { ContainerInventoryItem } from '@/lib/containers/types';

export default function ContractorInventoryPage() {
  const { id } = useParams() as { id: string };
  const containerId = Number(id);
  const { user } = usePrivy();
  const [items, setItems] = useState<ContainerInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const privyUserId = getCanonicalUserId(user.id);
    const email = extractEmailFromPrivyUser(user);
    // Resolve company via session
    const session = await fetch('/api/contractor/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privyUserId, email }),
    }).then((r) => r.json());

    const container = (session.containers || []).find(
      (c: { id: number }) => c.id === containerId
    );
    if (!container) {
      setWarning('You do not have access to this container.');
      setLoading(false);
      return;
    }

    const inv = await fetch(
      `/api/containers/inventory?companyId=${container.profile_id}&containerId=${containerId}&privyUserId=${encodeURIComponent(privyUserId || '')}&email=${encodeURIComponent(email || '')}`
    ).then((r) => r.json());

    setItems(inv.items || []);
    setWarning(inv.warning || null);
    setLoading(false);
  }, [user, containerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const receive = async () => {
    if (!user || !productName) return;
    setSaving(true);
    const session = await fetch('/api/contractor/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        privyUserId: getCanonicalUserId(user.id),
        email: extractEmailFromPrivyUser(user),
      }),
    }).then((r) => r.json());
    const container = (session.containers || []).find((c: { id: number }) => c.id === containerId);

    const res = await fetch('/api/containers/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: container?.profile_id,
        containerId,
        privyUserId: getCanonicalUserId(user.id),
        email: extractEmailFromPrivyUser(user),
        action: 'receive',
        product_name: productName,
        quantity: Number(qty),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Failed');
      return;
    }
    toast.success('Stock received');
    setProductName('');
    setQty('1');
    void load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  return (
    <div>
      <Link href="/contractor" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> My outlet
      </Link>
      <h1 className="text-2xl sm:text-3xl font-black text-[#00b4d8] mb-6">Inventory</h1>

      {warning && (
        <div className="mb-4 p-3 rounded-2xl bg-amber-50 text-amber-900 text-sm">{warning}</div>
      )}

      <div className="bg-white border rounded-3xl p-5 mb-6 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-[#00b4d8]" /> Receive stock
        </h2>
        <input
          className="input w-full !p-3 !text-base"
          placeholder="Product name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
        <input
          className="input w-full !p-3 !text-base"
          type="number"
          placeholder="Quantity"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <button type="button" disabled={saving} onClick={() => void receive()} className="btn-primary w-full !py-3">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Receive into outlet'}
        </button>
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center text-neutral-500">No stock lines yet.</div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const low = Number(item.qty_on_hand) <= Number(item.reorder_level || 0);
              return (
                <li key={item.id} className={`px-5 py-4 flex justify-between gap-3 ${low ? 'bg-amber-50/60' : ''}`}>
                  <div>
                    <div className="font-semibold">{item.product_name}</div>
                    <div className="text-xs text-neutral-500">{item.sku || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {item.qty_on_hand} {item.unit}
                    </div>
                    {low && (
                      <div className="text-xs text-amber-700 flex items-center gap-1 justify-end">
                        <AlertTriangle className="w-3 h-3" /> Low
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
