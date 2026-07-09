'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  Boxes,
  Loader2,
  MapPin,
  Package,
  ShoppingCart,
  TrendingUp,
  ClipboardList,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Scale,
} from 'lucide-react';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import type { ContainerRecord } from '@/lib/containers/types';

type OutletMetrics = {
  containerId: number;
  skuCount: number;
  unitsOnHand: number;
  lowStock: number;
  salesToday: number;
  salesTodayCount: number;
  openOrders: number;
};

export default function ContractorHomePage() {
  const { user, ready, authenticated } = usePrivy();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [metrics, setMetrics] = useState<OutletMetrics[]>([]);
  const [contractorName, setContractorName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready || !authenticated || !user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contractor/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyUserId: getCanonicalUserId(user.id),
          email: extractEmailFromPrivyUser(user),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      if (!data.isContractor) {
        if (data.isBusinessUser) {
          router.replace('/dashboard/select-company');
          return;
        }
        setError(
          'No operator access found for this login. Use the email from your invitation, or ask your company to re-invite you.'
        );
        setContainers([]);
        setMetrics([]);
      } else {
        setContainers(data.containers || []);
        setMetrics(data.metrics || []);
        setContractorName(
          data.primaryContractor?.full_name || extractEmailFromPrivyUser(user) || ''
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load portal');
    } finally {
      setLoading(false);
    }
  }, [ready, authenticated, user, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-3 text-slate-900">No outlet access</h1>
        <p className="text-neutral-600 mb-6">{error}</p>
        <button type="button" onClick={() => void load()} className="btn-primary px-6 py-3">
          Try again
        </button>
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">No container allocated</h1>
        <p className="text-neutral-600">
          Your company has not linked an outlet to your profile yet. Accept your invitation or ask
          them to re-invite you.
        </p>
      </div>
    );
  }

  if (containers.length === 1) {
    const c = containers[0];
    const m = metrics.find((x) => x.containerId === c.id);
    return (
      <OutletDashboard
        container={c}
        contractorName={contractorName}
        metrics={m}
        onRefresh={() => void load()}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-[-1.5px] text-[#00b4d8] mb-2">Your outlets</h1>
          <p className="text-neutral-600">
            Hi {contractorName || 'there'} — you only see containers allocated to you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-neutral-200"
          aria-label="Refresh"
        >
          <RefreshCw className="w-5 h-5 text-neutral-500" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {containers.map((c) => {
          const m = metrics.find((x) => x.containerId === c.id);
          return (
            <Link
              key={c.id}
              href={`/contractor/outlet/${c.id}`}
              className="bg-white border rounded-3xl p-6 hover:border-[#00b4d8] transition-colors"
            >
              <div className="font-bold text-xl text-slate-900">{c.name}</div>
              <div className="text-xs font-mono text-neutral-500 mt-1">{c.container_code}</div>
              <div className="text-sm text-neutral-600 mt-2 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {[c.city, c.province].filter(Boolean).join(', ') || '—'}
              </div>
              {m && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-emerald-50 px-3 py-2">
                    <div className="text-emerald-700 font-semibold">
                      R {Number(m.salesToday).toFixed(0)}
                    </div>
                    <div className="text-emerald-600/80">Sales today</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-3 py-2">
                    <div className="text-amber-800 font-semibold">{m.lowStock} low</div>
                    <div className="text-amber-700/80">{m.skuCount} SKUs</div>
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function OutletDashboard({
  container,
  contractorName,
  metrics,
  onRefresh,
}: {
  container: ContainerRecord;
  contractorName: string;
  metrics?: OutletMetrics;
  onRefresh: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-sm text-neutral-500">
          Welcome{contractorName ? `, ${contractorName}` : ''}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-neutral-500 inline-flex items-center gap-1 hover:text-[#00b4d8]"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
      <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-1">
        {container.name}
      </h1>
      <p className="text-neutral-600 mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">{container.container_code}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1 text-sm">
          <MapPin className="w-3.5 h-3.5" />
          {[container.city, container.province, container.country].filter(Boolean).join(', ') || '—'}
        </span>
      </p>

      {container.photo_url && (
        <div className="relative w-full h-40 sm:h-48 rounded-3xl overflow-hidden border mb-6 bg-neutral-100">
          <Image
            src={container.photo_url}
            alt={container.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Live metrics for this outlet only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <MetricCard
          label="Sales today"
          value={`R ${Number(metrics?.salesToday ?? 0).toFixed(0)}`}
          sub={`${metrics?.salesTodayCount ?? 0} transactions`}
          tone="emerald"
        />
        <MetricCard
          label="Units on hand"
          value={String(metrics?.unitsOnHand ?? 0)}
          sub={`${metrics?.skuCount ?? 0} products`}
          tone="sky"
        />
        <MetricCard
          label="Low stock"
          value={String(metrics?.lowStock ?? 0)}
          sub="at or below reorder"
          tone={metrics && metrics.lowStock > 0 ? 'amber' : 'neutral'}
          icon={metrics && metrics.lowStock > 0 ? AlertTriangle : undefined}
        />
        <MetricCard
          label="Open orders"
          value={String(metrics?.openOrders ?? 0)}
          sub="awaiting receive"
          tone="violet"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {[
          {
            href: `/contractor/outlet/${container.id}/inventory`,
            icon: Boxes,
            title: 'Inventory & receive',
            desc: 'View stock, receive deliveries, low-stock alerts',
          },
          {
            href: `/contractor/outlet/${container.id}/orders`,
            icon: ShoppingCart,
            title: 'Order stock',
            desc: 'Request replenishment for this outlet only',
          },
          {
            href: `/contractor/outlet/${container.id}/sales`,
            icon: TrendingUp,
            title: 'Record sales',
            desc: 'Log cash and card sales for the day',
          },
          {
            href: `/contractor/outlet/${container.id}/stock-count`,
            icon: ClipboardList,
            title: 'Stock count',
            desc: 'Count on-hand stock and submit adjustments',
          },
          {
            href: `/contractor/outlet/${container.id}/riad`,
            icon: Scale,
            title: 'RIAD log',
            desc: 'Log risks, issues, actions & decisions for this outlet',
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white border border-neutral-200 rounded-3xl p-6 hover:border-[#00b4d8] hover:shadow-md transition-all"
          >
            <card.icon className="w-7 h-7 text-[#00b4d8] mb-3" />
            <div className="font-bold text-lg text-slate-900">{card.title}</div>
            <div className="text-sm text-neutral-500 mt-1">{card.desc}</div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-neutral-400 text-center">
        Independent contractor access · you only operate container(s) allocated to your login ·
        company admin dashboards are not available
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'emerald' | 'sky' | 'amber' | 'violet' | 'neutral';
  icon?: typeof AlertTriangle;
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    sky: 'bg-sky-50 border-sky-100 text-sky-900',
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
    violet: 'bg-violet-50 border-violet-100 text-violet-900',
    neutral: 'bg-white border-neutral-200 text-slate-900',
  };
  return (
    <div className={`rounded-2xl border px-3 py-3 sm:px-4 sm:py-4 ${tones[tone]}`}>
      <div className="text-[11px] sm:text-xs font-medium opacity-70 mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-black tracking-tight">{value}</div>
      <div className="text-[10px] sm:text-xs opacity-60 mt-0.5">{sub}</div>
    </div>
  );
}
