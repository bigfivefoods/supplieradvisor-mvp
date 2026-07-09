'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowLeft, Loader2, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import type { ContainerOrder } from '@/lib/containers/types';

export default function ContractorOrdersPage() {
  const { id } = useParams() as { id: string };
  const containerId = Number(id);
  const { user } = usePrivy();
  const [orders, setOrders] = useState<ContainerOrder[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [lines, setLines] = useState([{ product_name: '', quantity: '1', unit: 'unit' }]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

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
      setDenied(true);
      setLoading(false);
      return;
    }
    setCompanyId(c.profile_id);
    const ord = await fetch(
      `/api/containers/orders?companyId=${c.profile_id}&containerId=${containerId}&privyUserId=${encodeURIComponent(privyUserId || '')}&email=${encodeURIComponent(email || '')}`
    ).then((r) => r.json());
    setOrders(ord.orders || []);
    setLoading(false);
  }, [user, containerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const place = async () => {
    if (!companyId || !user) return;
    const privyUserId = getCanonicalUserId(user.id);
    const email = extractEmailFromPrivyUser(user);
    const items = lines
      .filter((l) => l.product_name && Number(l.quantity) > 0)
      .map((l) => ({
        product_name: l.product_name,
        quantity: Number(l.quantity),
        unit: l.unit,
      }));
    if (!items.length) {
      toast.error('Add products');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/containers/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        containerId,
        items,
        status: 'ordered',
        privyUserId,
        email,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Failed');
      return;
    }
    toast.success('Order submitted to company');
    setLines([{ product_name: '', quantity: '1', unit: 'unit' }]);
    void load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-neutral-600 mb-4">You do not have access to this container.</p>
        <Link href="/contractor" className="btn-primary px-6 py-3 inline-block">
          Back to my outlet
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/contractor" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> My outlet
      </Link>
      <h1 className="text-2xl sm:text-3xl font-black text-[#00b4d8] mb-2">Order stock</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Orders are limited to this allocated outlet only.
      </p>

      <div className="bg-white border rounded-3xl p-5 mb-6 space-y-3">
        {lines.map((line, idx) => (
          <div key={idx} className="grid grid-cols-5 gap-2">
            <input
              className="input !p-2.5 !text-sm col-span-3"
              placeholder="Product"
              value={line.product_name}
              onChange={(e) => {
                const n = [...lines];
                n[idx] = { ...n[idx], product_name: e.target.value };
                setLines(n);
              }}
            />
            <input
              className="input !p-2.5 !text-sm col-span-2"
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) => {
                const n = [...lines];
                n[idx] = { ...n[idx], quantity: e.target.value };
                setLines(n);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-[#00b4d8] font-medium inline-flex items-center gap-1"
          onClick={() => setLines([...lines, { product_name: '', quantity: '1', unit: 'unit' }])}
        >
          <Plus className="w-4 h-4" /> Line
        </button>
        <button type="button" disabled={saving} onClick={() => void place()} className="btn-primary w-full !py-3">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit order'}
        </button>
      </div>

      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="bg-white border rounded-3xl p-8 text-center text-neutral-500 text-sm">
            No orders yet for this outlet.
          </div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="bg-white border rounded-3xl p-4">
              <div className="flex justify-between gap-2">
                <div className="font-semibold">{o.order_number || `#${o.id}`}</div>
                <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-neutral-100">
                  {o.status}
                </span>
              </div>
              <ul className="text-sm text-neutral-700 mt-2">
                {(o.items || []).map((it, i) => (
                  <li key={i}>
                    {it.product_name} × {it.quantity}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
