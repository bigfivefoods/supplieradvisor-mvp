'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import type { ContainerInventoryItem } from '@/lib/containers/types';

export default function StockCountPage() {
  const { id } = useParams() as { id: string };
  const containerId = Number(id);
  const { user } = usePrivy();
  const [items, setItems] = useState<ContainerInventoryItem[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const privyUserId = getCanonicalUserId(user.id);
    const email = extractEmailFromPrivyUser(user);
    const session = await fetch('/api/contractor/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privyUserId, email }),
    }).then((r) => r.json());
    const c = (session.containers || []).find((x: { id: number }) => x.id === containerId);
    if (!c) {
      setLoading(false);
      return;
    }
    const inv = await fetch(
      `/api/containers/inventory?companyId=${c.profile_id}&containerId=${containerId}&privyUserId=${encodeURIComponent(privyUserId || '')}&email=${encodeURIComponent(email || '')}`
    ).then((r) => r.json());
    const list = inv.items || [];
    setItems(list);
    const init: Record<number, string> = {};
    list.forEach((i: ContainerInventoryItem) => {
      init[i.id] = String(i.qty_on_hand);
    });
    setCounts(init);
    setLoading(false);
  }, [user, containerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const lines = items.map((i) => ({
      inventory_id: i.id,
      product_name: i.product_name,
      system_qty: Number(i.qty_on_hand),
      counted_qty: Number(counts[i.id] ?? i.qty_on_hand),
    }));
    const res = await fetch('/api/contractor/stock-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        privyUserId: getCanonicalUserId(user.id),
        email: extractEmailFromPrivyUser(user),
        containerId,
        lines,
        notes,
        applyAdjustments: true,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || data.hint || 'Failed');
      return;
    }
    toast.success('Stock count submitted and inventory adjusted');
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
      <h1 className="text-2xl sm:text-3xl font-black text-[#00b4d8] mb-2">Stock count</h1>
      <p className="text-neutral-600 mb-6 text-sm">
        Enter physical counts. Submitting will update on-hand quantities to match.
      </p>

      {items.length === 0 ? (
        <div className="bg-white border rounded-3xl p-10 text-center text-neutral-500">
          No inventory lines — receive stock first.
        </div>
      ) : (
        <div className="bg-white border rounded-3xl overflow-hidden mb-4">
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.product_name}</div>
                  <div className="text-xs text-neutral-500">System: {item.qty_on_hand}</div>
                </div>
                <input
                  className="input !p-2 !text-base w-24 text-right"
                  type="number"
                  value={counts[item.id] ?? ''}
                  onChange={(e) => setCounts({ ...counts, [item.id]: e.target.value })}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        className="input w-full !p-3 mb-4 min-h-[70px]"
        placeholder="Notes (shortages, damaged, etc.)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="button" disabled={saving || items.length === 0} onClick={() => void submit()} className="btn-primary w-full !py-3">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit stock count'}
      </button>
    </div>
  );
}
