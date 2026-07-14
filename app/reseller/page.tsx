'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Package, Banknote, ShoppingCart } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId, extractEmailFromPrivyUser } from '@/lib/auth/identity';

export default function ResellerHomePage() {
  const { user } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    isReseller: boolean;
    companyName?: string;
    resellers?: Array<{
      id: number;
      full_name: string;
      verification_status?: string;
    }>;
    inventory?: Array<{ qty_on_hand: number }>;
    sales?: Array<{ total_amount: number; commission_total: number }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reseller/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyUserId: getCanonicalUserId(user.id),
          email: extractEmailFromPrivyUser(user),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error || !data?.isReseller) {
    return (
      <div className="rounded-3xl border bg-white p-8 text-center">
        <h1 className="text-xl font-black mb-2">No reseller access</h1>
        <p className="text-sm text-slate-600 mb-4">
          {error ||
            'You are not linked as a container reseller. Use the invite link from your network operator.'}
        </p>
        <Link
          href="/reseller/invite"
          className="text-sm font-bold text-[#0077b6] hover:underline"
        >
          Have an invite code? →
        </Link>
      </div>
    );
  }

  const stock = (data.inventory || []).reduce(
    (s, i) => s + Number(i.qty_on_hand || 0),
    0
  );
  const sales = (data.sales || []).reduce(
    (s, i) => s + Number(i.total_amount || 0),
    0
  );
  const commission = (data.sales || []).reduce(
    (s, i) => s + Number(i.commission_total || 0),
    0
  );
  const me = data.resellers?.[0];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {data.companyName}
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Hi{me?.full_name ? `, ${me.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-slate-500">
          Verification:{' '}
          <strong className="capitalize">
            {me?.verification_status || '—'}
          </strong>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi icon={Package} label="Units on hand" value={String(Math.round(stock * 10) / 10)} />
        <Kpi
          icon={ShoppingCart}
          label="Sales"
          value={`R${sales.toLocaleString('en-ZA')}`}
        />
        <Kpi
          icon={Banknote}
          label="Commission earned"
          value={`R${commission.toLocaleString('en-ZA')}`}
          tone="emerald"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          href="/reseller/sell"
          className="rounded-3xl border border-[#00b4d8]/30 bg-gradient-to-br from-sky-50 to-white p-5 hover:border-[#00b4d8] transition-all"
        >
          <ShoppingCart className="w-6 h-6 text-[#00b4d8] mb-2" />
          <div className="font-black text-slate-900">Record a sale</div>
          <p className="text-xs text-slate-500 mt-1">
            Sell from your stock and earn item commission automatically.
          </p>
        </Link>
        <Link
          href="/reseller/stock"
          className="rounded-3xl border border-slate-200 bg-white p-5 hover:border-[#00b4d8] transition-all"
        >
          <Package className="w-6 h-6 text-[#00b4d8] mb-2" />
          <div className="font-black text-slate-900">My stock</div>
          <p className="text-xs text-slate-500 mt-1">
            Inventory drawn to you from container outlets.
          </p>
        </Link>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'neutral' | 'emerald';
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        tone === 'emerald'
          ? 'border-emerald-100 bg-emerald-50/40'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 mb-0.5">
        <Icon className="w-3 h-3 text-[#00b4d8]" />
        {label}
      </div>
      <div className="text-lg font-black tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}
