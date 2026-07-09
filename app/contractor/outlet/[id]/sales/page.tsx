'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';

type Sale = {
  id: number;
  sale_date: string;
  gross_amount: number;
  payment_method?: string;
  notes?: string;
};

export default function ContractorSalesPage() {
  const { id } = useParams() as { id: string };
  const containerId = Number(id);
  const { user } = usePrivy();
  const [sales, setSales] = useState<Sale[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const privyUserId = getCanonicalUserId(user.id);
    const email = extractEmailFromPrivyUser(user);
    const res = await fetch(
      `/api/contractor/sales?containerId=${containerId}&privyUserId=${encodeURIComponent(privyUserId || '')}&email=${encodeURIComponent(email || '')}`
    );
    const data = await res.json();
    setSales(data.sales || []);
    setLoading(false);
  }, [user, containerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const record = async () => {
    if (!user || !amount) return;
    setSaving(true);
    const res = await fetch('/api/contractor/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        privyUserId: getCanonicalUserId(user.id),
        email: extractEmailFromPrivyUser(user),
        containerId,
        gross_amount: Number(amount),
        payment_method: method,
        notes,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Failed');
      return;
    }
    toast.success('Sale recorded');
    setAmount('');
    setNotes('');
    void load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  const todayTotal = sales
    .filter((s) => s.sale_date === new Date().toISOString().slice(0, 10))
    .reduce((sum, s) => sum + Number(s.gross_amount || 0), 0);

  return (
    <div>
      <Link href="/contractor" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> My outlet
      </Link>
      <h1 className="text-2xl sm:text-3xl font-black text-[#00b4d8] mb-2">Sales</h1>
      <p className="text-neutral-600 mb-6">
        Today so far: <strong>R {todayTotal.toFixed(2)}</strong>
      </p>

      <div className="bg-white border rounded-3xl p-5 space-y-3 mb-6">
        <input
          className="input w-full !p-3 !text-base"
          type="number"
          placeholder="Amount (R)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select className="input w-full !p-3 !text-base" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="mobile">Mobile money</option>
          <option value="other">Other</option>
        </select>
        <input
          className="input w-full !p-3 !text-base"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="button" disabled={saving} onClick={() => void record()} className="btn-primary w-full !py-3">
          Record sale
        </button>
      </div>

      <ul className="space-y-2">
        {sales.map((s) => (
          <li key={s.id} className="bg-white border rounded-2xl px-4 py-3 flex justify-between text-sm">
            <span>
              {s.sale_date} · {s.payment_method || 'cash'}
            </span>
            <strong>R {Number(s.gross_amount).toFixed(2)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
