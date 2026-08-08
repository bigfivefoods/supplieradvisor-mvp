'use client';

/**
 * Industry Tools hub — additive to existing modules.
 * Deep-links into full module features (never replaces Suppliers/Customers/Make/etc.).
 */
import Link from 'next/link';
import {
  Layers,
  ArrowRight,
  Package,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import {
  INDUSTRY_PACKS,
  getIndustryPack,
  CORE_OS_MONTHLY_ZAR,
  INDUSTRY_PACK_MONTHLY_ZAR,
} from '@/lib/product/architecture';

export default function IndustryToolsPage() {
  const { packaging, loading, isCompanyModuleEnabled } = useCompanyRole();
  const packIds = packaging?.packIds || [];
  const packs = packIds
    .map((id) => getIndustryPack(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
          Industry Tools
        </p>
        <h1 className="text-2xl font-black text-slate-900 mt-1">
          Packs on top of Core OS
        </h1>
        <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
          Industry Packs unlock shortcuts into capabilities you already have
          under <strong>Suppliers</strong>, <strong>Customers</strong>,{' '}
          <strong>Make</strong>, <strong>Containers</strong>,{' '}
          <strong>Schools</strong>, and the rest of the sidebar. Nothing is
          removed — packs surface the right entry points faster.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 flex flex-wrap gap-4">
        <span>
          Core OS <strong>R{CORE_OS_MONTHLY_ZAR}/mo</strong>
        </span>
        <span>
          Each pack <strong>+R{INDUSTRY_PACK_MONTHLY_ZAR}/mo</strong>
        </span>
        <span>
          Active packs: <strong>{packs.length || 0}</strong>
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading packaging…</p>
      ) : !packs.length ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-800">No Industry Packs active</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You are on Core OS. All standard modules (Suppliers, Customers, Ops,
            Inventory, Finance…) remain in the sidebar when enabled under
            Company → Modules.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/dashboard/my-business/modules"
              className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1"
            >
              Company modules <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard/my-business/packaging"
              className="btn-secondary !py-2 !px-4 text-sm"
            >
              Packaging & packs
            </Link>
          </div>
          <div className="pt-6 text-left max-w-lg mx-auto">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">
              Priority 1 packs available
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {INDUSTRY_PACKS.filter((p) => p.priority === 1).map((p) => (
                <li key={p.id} className="flex gap-2">
                  <Package className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>{p.name}</strong> — {p.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {packs.map((p) => (
            <li
              key={p.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-black text-slate-900 text-lg">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                </div>
                <Link
                  href={`/dashboard/industry-tools/${p.id}`}
                  className="text-xs font-bold text-[#0077b6] border border-sky-200 bg-sky-50 rounded-lg px-3 py-1.5 shrink-0"
                >
                  Pack dashboard →
                </Link>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">
                  Modules in this pack
                </p>
                <div className="flex flex-wrap gap-2">
                  {p.modules.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-700 px-2.5 py-1"
                      title={m.description}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">
                  Open in full modules (all features)
                </p>
                <div className="flex flex-wrap gap-2">
                  {p.industryToolsHrefs.map((t) => (
                    <Link
                      key={t.href + t.name}
                      href={t.href}
                      className="text-xs font-bold text-[#0077b6] border border-sky-200 bg-sky-50 hover:bg-sky-100 rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
                    >
                      {t.name}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </Link>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Unlocks app hubs:{' '}
                {[
                  ...new Set(p.modules.flatMap((m) => m.unlocks)),
                ]
                  .filter((id) => isCompanyModuleEnabled(id))
                  .join(', ') || '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
