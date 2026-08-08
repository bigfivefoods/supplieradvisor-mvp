'use client';

/**
 * Packaging settings — view Core OS + Industry Packs (Phase 2).
 * Does not remove module features; links to full Modules admin.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowRight,
  Building2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import {
  CORE_OS_MONTHLY_ZAR,
  INDUSTRY_PACK_MONTHLY_ZAR,
  INDUSTRY_PACKS,
  OS_ENTITY_TYPES,
  OS_SECTORS,
  getIndustryPack,
  monthlyPriceZar,
} from '@/lib/product/architecture';

export default function PackagingSettingsPage() {
  const { packaging, businessType, loading } = useCompanyRole();
  const packIds = packaging?.packIds || [];
  const price = useMemo(() => monthlyPriceZar(packIds), [packIds]);
  const entityLabel =
    OS_ENTITY_TYPES.find((e) => e.id === packaging?.entityTypeId)?.label ||
    businessType ||
    '—';
  const sectorLabel =
    OS_SECTORS.find((s) => s.id === packaging?.sectorId)?.label ||
    packaging?.sectorId ||
    '—';
  const contactRequired =
    packaging?.setupStatus === 'contact_required' ||
    packaging?.setupStatus === 'pending_specialist';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
          Administration · Packaging
        </p>
        <h1 className="text-2xl font-black text-slate-900 mt-1">
          Core OS & Industry Packs
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Packaging controls recommendations and Industry Tools shortcuts. Your
          full module feature set (every process under Suppliers, Customers,
          Schools, Make, etc.) stays available under each hub.
        </p>
      </div>

      {contactRequired ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <strong>Specialist setup required.</strong> Provincial / National
            workspaces complete pack selection, then a SupplierAdvisor specialist
            finishes activation and multi-entity configuration.
            <div className="mt-2">
              <Link
                href="/dashboard/my-business/billing?setup=contact_required"
                className="font-bold underline"
              >
                View setup status →
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 text-sm">
            <Row label="Entity type" value={entityLabel} />
            <Row label="Sector" value={String(sectorLabel)} />
            <Row
              label="Setup status"
              value={String(packaging?.setupStatus || 'active')}
            />
            <Row
              label="Est. monthly"
              value={`R${price.total} (Core R${price.core}${
                price.packCount
                  ? ` + ${price.packCount}×R${INDUSTRY_PACK_MONTHLY_ZAR}`
                  : ''
              })`}
            />
          </div>

          <div>
            <h2 className="text-sm font-black text-slate-900 mb-2">
              Active packs
            </h2>
            {!packIds.length ? (
              <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
                Core OS only (R{CORE_OS_MONTHLY_ZAR}/mo). Add packs at
                onboarding or contact support for pack changes.
              </p>
            ) : (
              <ul className="space-y-2">
                {packIds.map((id) => {
                  const p = getIndustryPack(id);
                  return (
                    <li
                      key={id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">
                          {p?.name || id}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {p?.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/industry-tools"
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5" /> Industry Tools
            </Link>
            <Link
              href="/dashboard/my-business/modules"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5" /> All module toggles
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <strong>Catalogue:</strong>{' '}
            {INDUSTRY_PACKS.map((p) => p.shortName).join(' · ')}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-slate-50 pb-2 last:border-0">
      <span className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900 text-right">
        {value}
      </span>
    </div>
  );
}
