'use client';

/**
 * Industry Tools hub — only meaningful when Industry Packs are active.
 */
import Link from 'next/link';
import { Layers, ArrowRight } from 'lucide-react';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { INDUSTRY_PACKS, getIndustryPack } from '@/lib/product/architecture';

export default function IndustryToolsPage() {
  const { packaging, loading } = useCompanyRole();
  const packIds = packaging?.packIds || [];

  const packs = packIds
    .map((id) => getIndustryPack(id))
    .filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
          Industry Tools
        </p>
        <h1 className="text-2xl font-black text-slate-900 mt-1">
          Pack capabilities
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Tools unlocked by your Industry Packs. Core navigation stays
          functional (Suppliers, Customers, Ops…) — this area is packaging-aware.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !packs.length ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-800">No Industry Packs active</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            You are on Core OS. Add packs under Administration → Modules /
            Billing when pack management ships, or re-run onboarding with packs.
          </p>
          <Link
            href="/dashboard/my-business/modules"
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1 mt-4"
          >
            Company modules <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {packs.map((p) =>
            p ? (
              <li
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <p className="font-black text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.industryToolsHrefs.map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      className="text-xs font-bold text-[#0077b6] border border-sky-200 bg-sky-50 hover:bg-sky-100 rounded-lg px-3 py-1.5"
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              </li>
            ) : null
          )}
        </ul>
      )}

      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Available packs catalogue: {INDUSTRY_PACKS.length} Priority-1 packs
        (Agri, Food Mfg, Logistics, Fitness, Dental, Allied Health, Impact,
        Public Procurement).
      </div>
    </div>
  );
}
