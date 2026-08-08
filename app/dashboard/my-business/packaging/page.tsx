'use client';

/**
 * Packaging settings — view + manage Core OS & Industry Packs (Phase 3).
 * Packs ADD module access and Industry Tools shortcuts; never remove feature trees.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowRight,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  Package,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  extractEmailFromPrivyUser,
  getCanonicalUserId,
} from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import {
  CORE_OS_MONTHLY_ZAR,
  INDUSTRY_PACK_MONTHLY_ZAR,
  INDUSTRY_PACKS,
  OS_ENTITY_TYPES,
  OS_SECTORS,
  getIndustryPack,
  monthlyPriceZar,
  type PackagingSelection,
} from '@/lib/product/architecture';
import {
  getPaystackPublicKey,
  openPaystackCheckout,
} from '@/lib/billing/paystack-client';
import { quoteIndustryPacks } from '@/lib/billing/pack-pricing';
import type { BillingTermId } from '@/lib/billing/company-subscription';

export default function PackagingSettingsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const email = extractEmailFromPrivyUser(user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [packaging, setPackaging] = useState<PackagingSelection | null>(null);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [payTermId] = useState<BillingTermId>('monthly');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/business/packaging?companyId=${companyId}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setPackaging(data.packaging || null);
      setSelectedPacks(data.packaging?.packIds || []);
      setSelectedModules(data.packaging?.moduleIds || []);
      setBusinessType(
        data.businessType != null ? String(data.businessType) : null
      );
      setDirty(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const price = useMemo(
    () => monthlyPriceZar(selectedPacks),
    [selectedPacks]
  );
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

  const modulesForPacks = useMemo(() => {
    const out: Array<{
      id: string;
      name: string;
      description: string;
      packName: string;
    }> = [];
    for (const pid of selectedPacks) {
      const p = getIndustryPack(pid);
      if (!p) continue;
      for (const m of p.modules) {
        out.push({
          id: m.id,
          name: m.name,
          description: m.description,
          packName: p.shortName,
        });
      }
    }
    return out;
  }, [selectedPacks]);

  const togglePack = (id: string) => {
    setSelectedPacks((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      // Drop modules from removed packs
      const valid = new Set(
        next.flatMap(
          (pid) => getIndustryPack(pid)?.modules.map((m) => m.id) || []
        )
      );
      setSelectedModules((mods) => mods.filter((m) => valid.has(m)));
      return next;
    });
    setDirty(true);
  };

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/business/packaging', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          packIds: selectedPacks,
          moduleIds: selectedModules,
          entityTypeId: packaging?.entityTypeId,
          sectorId: packaging?.sectorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(data.message || 'Packaging saved');
      setDirty(false);
      void load();
      // Refresh sidebar module gates
      window.dispatchEvent(new Event('sa:company-changed'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /** Pay only for newly selected packs (vs previously saved) via Paystack / Apple Pay */
  const payForNewPacks = async () => {
    const prev = new Set(packaging?.packIds || []);
    const added = selectedPacks.filter((id) => !prev.has(id));
    if (!added.length) {
      toast.message('No new packs to pay for — save free toggles, or pick more packs');
      return;
    }
    const key = getPaystackPublicKey();
    if (!key || !email) {
      toast.error(
        !email
          ? 'Sign in with an email for Paystack'
          : 'Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY'
      );
      return;
    }
    const q = quoteIndustryPacks(added, payTermId);
    if (!(q.payCents > 0)) {
      toast.error('Invalid pack quote');
      return;
    }
    setPaying(true);
    const ref = `sa-packs-${payTermId}-${companyId}-${Date.now()}`;
    try {
      await openPaystackCheckout({
        key,
        email,
        amountCents: q.payCents,
        ref,
        metadata: {
          product: 'industry_packs',
          company_id: String(companyId),
          term_id: payTermId,
          pack_ids: added.join(','),
          pack_count: String(added.length),
        },
        onSuccess: async (reference) => {
          try {
            const res = await fetch('/api/business/subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId,
                privyUserId,
                action: 'activate',
                paystackReference: reference,
                termId: payTermId,
                packIds: added,
                product: 'industry_packs',
                packsOnly: true,
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Activation failed');
            // Persist full selected packs (including previous)
            await fetch('/api/business/packaging', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId,
                packIds: selectedPacks,
                moduleIds: selectedModules,
                entityTypeId: packaging?.entityTypeId,
                sectorId: packaging?.sectorId,
              }),
            });
            toast.success(
              data.channel === 'apple_pay'
                ? `Packs activated via Apple Pay · R${q.payZar}`
                : `Packs activated · R${q.payZar}`
            );
            setDirty(false);
            void load();
            window.dispatchEvent(new Event('sa:company-changed'));
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Activation failed');
          } finally {
            setPaying(false);
          }
        },
        onClose: () => setPaying(false),
        onError: () => setPaying(false),
      });
    } catch (e: unknown) {
      setPaying(false);
      toast.error(e instanceof Error ? e.message : 'Checkout failed');
    }
  };

  const newPacksQuote = useMemo(() => {
    const prev = new Set(packaging?.packIds || []);
    const added = selectedPacks.filter((id) => !prev.has(id));
    return quoteIndustryPacks(added, payTermId);
  }, [packaging?.packIds, selectedPacks, payTermId]);

  return (
    <BusinessPage>
      <BusinessHeader
        title="Packaging"
        titleAccent="Core OS · Packs"
        description="Manage Industry Packs. Packs unlock hubs and Industry Tools shortcuts — full process trees under Suppliers, Customers, Make, Schools, etc. are never removed."
        action={
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save packs
          </button>
        }
      />

      {contactRequired ? (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <strong>Specialist setup required.</strong> You can still select
            packs for the specialist; full go-live follows SupplierAdvisor
            confirmation.
            <Link
              href="/dashboard/my-business/billing?setup=contact_required"
              className="block font-bold underline mt-1"
            >
              Setup status →
            </Link>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
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
            <h2 className="text-sm font-black text-slate-900 mb-1">
              Industry Packs
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">
              Core OS R{CORE_OS_MONTHLY_ZAR}/mo always included. Each pack +R
              {INDUSTRY_PACK_MONTHLY_ZAR}/mo. Toggle packs and save.
            </p>
            <ul className="space-y-2">
              {INDUSTRY_PACKS.map((p) => {
                const on = selectedPacks.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => togglePack(p.id)}
                      className={`w-full text-left rounded-2xl border-2 p-4 flex gap-3 transition ${
                        on
                          ? 'border-[#00b4d8] bg-sky-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          on
                            ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {on ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-sm">{p.name}</p>
                          <span className="text-[10px] font-bold text-slate-500">
                            +R{p.monthlyZar}/mo
                          </span>
                          <Link
                            href={`/dashboard/industry-tools/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] font-bold text-[#0077b6] hover:underline"
                          >
                            Pack dashboard →
                          </Link>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {p.description}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {modulesForPacks.length > 0 ? (
            <div>
              <h2 className="text-sm font-black text-slate-900 mb-1">
                Pack modules (optional filter)
              </h2>
              <p className="text-[11px] text-slate-500 mb-3">
                Leave empty to enable all modules in selected packs. Otherwise
                only ticked modules unlock their hubs.
              </p>
              <ul className="space-y-1.5">
                {modulesForPacks.map((m) => {
                  const on = selectedModules.includes(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => toggleModule(m.id)}
                        className={`w-full text-left rounded-xl border px-3 py-2 flex gap-2 text-sm ${
                          on
                            ? 'border-[#00b4d8] bg-sky-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <Package
                          className={`w-4 h-4 shrink-0 mt-0.5 ${on ? 'text-[#0077b6]' : 'text-slate-400'}`}
                        />
                        <span>
                          <span className="font-bold">{m.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {' '}
                            · {m.packName}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {m.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void save()}
              className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save packaging
            </button>
            {newPacksQuote.packCount > 0 ? (
              <button
                type="button"
                disabled={paying}
                onClick={() => void payForNewPacks()}
                className="btn-secondary !py-2 !px-4 text-xs inline-flex items-center gap-1 border-emerald-300 text-emerald-900 bg-emerald-50"
                title="Pay for newly selected packs via Paystack (Apple Pay on Safari)"
              >
                {paying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CreditCard className="w-3.5 h-3.5" />
                )}
                Pay {newPacksQuote.packCount} new pack(s) · R
                {newPacksQuote.payZar}
              </button>
            ) : null}
            <Link
              href="/dashboard/my-business/billing"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              Billing · Core + packs
            </Link>
            <Link
              href="/dashboard/industry-tools"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
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

          <p className="text-[11px] text-slate-500 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            Saving packs turns on related hubs (e.g. Make, Containers, Schools)
            without deleting process steps under any module. Use{' '}
            <strong>Modules</strong> to show/hide entire hubs in the sidebar.
          </p>
        </div>
      )}
    </BusinessPage>
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
