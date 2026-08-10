'use client';

/**
 * Pack-specific dashboard template — shortcuts into full module features.
 * Does not replace MODULE_NAV hubs.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Layers,
  Package,
  CheckCircle2,
} from 'lucide-react';
import {
  getIndustryPack,
  INDUSTRY_PACK_MONTHLY_ZAR,
} from '@/lib/product/architecture';

export default function PackDashboardPage() {
  const params = useParams();
  const packId = String(params?.packId || '');
  const pack = useMemo(() => getIndustryPack(packId), [packId]);

  if (!pack) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-3">
        <p className="font-black text-slate-900">Pack not found</p>
        <Link
          href="/dashboard/industry-tools"
          className="text-sm font-bold text-[#0077b6] underline"
        >
          ← Industry Tools
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/dashboard/industry-tools"
        className="text-xs font-bold text-[#0077b6] inline-flex items-center gap-1 hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Industry Tools
      </Link>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
          Industry Pack · +R{INDUSTRY_PACK_MONTHLY_ZAR}/mo
        </p>
        <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
          <Layers className="w-7 h-7 text-[#00b4d8]" />
          {pack.name}
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          {pack.description} This page is a <strong>template dashboard</strong>{' '}
          — every link opens the full module with all existing process steps.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-black text-slate-900">Pack modules</h2>
        <ul className="space-y-2">
          {pack.modules.map((m) => (
            <li
              key={m.id}
              className="flex gap-2 text-sm border-b border-slate-50 pb-2 last:border-0"
            >
              <Package className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{m.name}</p>
                <p className="text-[11px] text-slate-500">{m.description}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Unlocks hubs: {m.unlocks.join(', ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-sky-50/50 p-5 space-y-3">
        <h2 className="text-sm font-black text-slate-900">
          Open full product features
        </h2>
        <p className="text-[11px] text-slate-600">
          These are the same destinations as the main sidebar — nothing is
          stripped.
        </p>
        <div className="flex flex-wrap gap-2">
          {pack.industryToolsHrefs.map((t) => (
            <Link
              key={t.href + t.name}
              href={t.href}
              className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-[#0077b6] hover:bg-sky-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {t.name}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href="/dashboard/my-business/modules"
          className="font-bold text-[#0077b6] underline"
        >
          Manage packs
        </Link>
        <Link
          href="/dashboard/my-business/modules"
          className="font-bold text-[#0077b6] underline"
        >
          All module toggles
        </Link>
      </div>
    </div>
  );
}
