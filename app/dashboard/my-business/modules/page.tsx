'use client';

/**
 * Company → Modules — single home for sector/industry, packs, and workspace hubs.
 * Packaging is folded in here (no separate Packaging nav item).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  Loader2,
  Save,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Building2,
  Users,
  Network,
  Package,
  CreditCard,
  Layers,
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
  BusinessPage,
  BusinessHeader,
} from '@/components/business/BusinessShell';
import { SectionLabel } from '@/components/relationship/RelationshipChrome';
import {
  MODULE_BANDS,
  MODULE_CATEGORIES,
  countEnabledOptionalModules,
  extractEnabledModulesFromMetadata,
  hasModulesConfigured,
  isAlwaysOnModule,
  listCompanyModuleOptions,
  mergeEnabledModulesIntoMetadata,
  normalizeEnabledModules,
  type EnabledModulesMap,
} from '@/lib/business/company-modules';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import {
  CORE_OS_MONTHLY_ZAR,
  INDUSTRY_PACK_MONTHLY_ZAR,
  OS_ENTITY_TYPES,
  OS_SECTORS,
  PUBLIC_SECTOR_TIERS,
  SA_NATIONAL_DEPARTMENTS,
  appModulesUnlockedByPack,
  enabledModulesMapFromPacks,
  getIndustryPack,
  industryPacksBySector,
  monthlyPriceZar,
  packsUnlockingAppModule,
  publicSectorTierForEntity,
  readPackBillingFromMetadata,
  readPackagingFromMetadata,
} from '@/lib/product/architecture';
import {
  getBusinessType,
  getIndustry,
  industriesForSector,
  packIdsForSector,
} from '@/lib/product/business-catalogue';
import {
  getPaystackPublicKey,
  openPaystackCheckout,
} from '@/lib/billing/paystack-client';
import { quoteIndustryPacks } from '@/lib/billing/pack-pricing';
import type { BillingTermId } from '@/lib/billing/company-subscription';

export default function CompanyModulesPage() {
  return (
    <CompanyRequired>
      <ModulesInner />
    </CompanyRequired>
  );
}

function ModulesInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const email = extractEmailFromPrivyUser(user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState<EnabledModulesMap>(() =>
    normalizeEnabledModules(null)
  );
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [tradingName, setTradingName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [packsDirty, setPacksDirty] = useState(false);
  const [govLocked, setGovLocked] = useState(false);
  const [platformOperator, setPlatformOperator] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [draftSector, setDraftSector] = useState('');
  const [draftIndustryIds, setDraftIndustryIds] = useState<string[]>([]);
  const [draftBusinessTypeIds, setDraftBusinessTypeIds] = useState<string[]>(
    []
  );
  const payTermId: BillingTermId = 'monthly';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const [res, ctrlRes] = await Promise.all([
        fetch(`/api/business/profile?${params}`),
        fetch('/api/system/platform-control', { cache: 'no-store' }),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const profile = data.profile || {};
      setTradingName(String(profile.trading_name || ''));
      const meta =
        profile.metadata && typeof profile.metadata === 'object'
          ? (profile.metadata as Record<string, unknown>)
          : {};
      setMetadata(meta);
      setEnabled(extractEnabledModulesFromMetadata(meta));
      const packSel = readPackagingFromMetadata(meta);
      setSelectedPacks(packSel?.packIds || []);
      setPacksDirty(false);
      const org = `${profile.org_type || ''} ${profile.business_type || ''}`.toLowerCase();
      const isGov =
        org.includes('government') ||
        org.includes('dbe') ||
        org.includes('health');
      let operator = false;
      if (ctrlRes.ok) {
        const ctrl = await ctrlRes.json();
        operator = Boolean(ctrl.operator);
        setPlatformOperator(operator);
        if (ctrl.messages?.module_lock) {
          setLockMessage(String(ctrl.messages.module_lock));
        }
      }
      setGovLocked(isGov && !operator);
      setDirty(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const packaging = useMemo(
    () => readPackagingFromMetadata(metadata),
    [metadata]
  );

  // Prefill draft classification from existing packaging
  useEffect(() => {
    if (packaging?.sectorId) setDraftSector(String(packaging.sectorId));
    const inds = [
      ...(packaging?.industryIds || []),
      ...(packaging?.industryId ? [String(packaging.industryId)] : []),
    ];
    setDraftIndustryIds([...new Set(inds.map(String))]);
    const bts = [
      ...(packaging?.businessTypeIds || []),
      ...(packaging?.businessTypeId
        ? [String(packaging.businessTypeId)]
        : []),
    ];
    setDraftBusinessTypeIds([...new Set(bts.map(String))]);
  }, [
    packaging?.sectorId,
    packaging?.industryId,
    packaging?.industryIds,
    packaging?.businessTypeId,
    packaging?.businessTypeIds,
  ]);
  const packBilling = useMemo(
    () => readPackBillingFromMetadata(metadata),
    [metadata]
  );
  const subscribedPackIds = useMemo(
    () => new Set(packaging?.packIds || []),
    [packaging]
  );
  const selectedPackIds = useMemo(
    () => new Set(selectedPacks),
    [selectedPacks]
  );
  const packPrice = useMemo(
    () => monthlyPriceZar(selectedPacks),
    [selectedPacks]
  );
  const newPacksQuote = useMemo(() => {
    const prev = new Set(packaging?.packIds || []);
    const added = selectedPacks.filter((id) => !prev.has(id));
    return quoteIndustryPacks(added, payTermId);
  }, [packaging?.packIds, selectedPacks, payTermId]);
  const paidActive = useMemo(() => {
    if (!packBilling.paidUntil) return false;
    const t = Date.parse(packBilling.paidUntil);
    return Number.isFinite(t) && t > Date.now();
  }, [packBilling.paidUntil]);

  const entityLabel =
    OS_ENTITY_TYPES.find((e) => e.id === packaging?.entityTypeId)?.label ||
    'Not set';
  const sectorLabel =
    OS_SECTORS.find((s) => s.id === packaging?.sectorId)?.label ||
    packaging?.sectorId ||
    'Not set';
  const yourSectorId = packaging?.sectorId || null;

  const sectorGroups = useMemo(() => industryPacksBySector(), []);

  /** Only the company's registered sector (and its industry packs) */
  const orderedSectorGroups = useMemo(() => {
    if (!yourSectorId) return sectorGroups;
    return sectorGroups.filter((g) => g.sectorId === yourSectorId);
  }, [sectorGroups, yourSectorId]);

  const companyIndustries = useMemo(() => {
    const ids = [
      ...(packaging?.industryIds || []),
      ...(packaging?.industryId ? [String(packaging.industryId)] : []),
    ];
    return [...new Set(ids.map(String))]
      .map((id) => getIndustry(id))
      .filter(Boolean) as NonNullable<ReturnType<typeof getIndustry>>[];
  }, [packaging?.industryId, packaging?.industryIds]);
  const companyIndustry = companyIndustries[0] || null;
  const companyBusinessType = useMemo(() => {
    for (const ind of companyIndustries) {
      for (const btid of [
        ...(packaging?.businessTypeIds || []),
        ...(packaging?.businessTypeId
          ? [String(packaging.businessTypeId)]
          : []),
      ]) {
        const bt = getBusinessType(ind.id, btid);
        if (bt) return bt;
      }
    }
    return null;
  }, [companyIndustries, packaging?.businessTypeId, packaging?.businessTypeIds]);
  const sectorIndustries = useMemo(
    () => industriesForSector(yourSectorId),
    [yourSectorId]
  );

  const subscribedPacks = useMemo(
    () =>
      (packaging?.packIds || [])
        .map((id) => getIndustryPack(id))
        .filter(Boolean) as NonNullable<ReturnType<typeof getIndustryPack>>[],
    [packaging]
  );

  const counts = useMemo(
    () => countEnabledOptionalModules(enabled),
    [enabled]
  );
  const configured = hasModulesConfigured(metadata);

  const optionsById = useMemo(() => {
    const m = new Map(listCompanyModuleOptions().map((o) => [o.id, o]));
    return m;
  }, []);

  const persist = async (map: EnabledModulesMap, silent?: boolean) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    if (govLocked) {
      toast.message(
        lockMessage ||
          'Programme modules for government departments are managed centrally.'
      );
      return;
    }
    setSaving(true);
    try {
      const nextMeta = mergeEnabledModulesIntoMetadata(metadata, map, {
        markConfigured: true,
      });
      const res = await fetch('/api/business/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          metadata: nextMeta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const savedMeta =
        data.profile?.metadata && typeof data.profile.metadata === 'object'
          ? (data.profile.metadata as Record<string, unknown>)
          : nextMeta;
      setMetadata(savedMeta);
      setEnabled(extractEnabledModulesFromMetadata(savedMeta));
      setDirty(false);
      window.dispatchEvent(new Event('sa:company-changed'));
      if (!silent) toast.success('Workspace modules saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  /** Quick presets = only this company's sector + industry (not global catalogue) */
  const sectorIndustryPresets = useMemo(() => {
    const allIds = MODULE_NAV.map((m) => m.id);
    const out: Array<{
      id: string;
      label: string;
      description: string;
      map: EnabledModulesMap;
    }> = [];

    if (yourSectorId) {
      const sectorPackIds = packIdsForSector(yourSectorId);
      const map = enabledModulesMapFromPacks(
        sectorPackIds,
        [],
        allIds
      ) as EnabledModulesMap;
      const packNames = sectorPackIds
        .map((id) => getIndustryPack(id)?.shortName || id)
        .filter(Boolean);
      out.push({
        id: `sector:${yourSectorId}`,
        label: `${sectorLabel} sector`,
        description: packNames.length
          ? `Enable hubs for ${sectorLabel}: ${packNames.join(', ')}.`
          : `Core hubs recommended for the ${sectorLabel} sector.`,
        map,
      });
    }

    if (companyIndustries.length) {
      const industryPacks = [
        ...new Set([
          ...companyIndustries.flatMap((i) => i.packIds),
          ...(packaging?.packIds || []),
        ]),
      ];
      const map = enabledModulesMapFromPacks(
        industryPacks,
        packaging?.moduleIds || [],
        allIds
      ) as EnabledModulesMap;
      const packNames = industryPacks
        .map((id) => getIndustryPack(id)?.shortName || id)
        .filter(Boolean);
      const labels = companyIndustries.map((i) => i.label).join(' · ');
      out.push({
        id: `industries:${companyIndustries.map((i) => i.id).join('+')}`,
        label:
          companyIndustries.length === 1
            ? companyIndustries[0].label
            : `${companyIndustries.length} industries`,
        description: packNames.length
          ? `${labels} · packs: ${packNames.join(', ')}.`
          : labels,
        map,
      });
    }

    return out;
  }, [yourSectorId, sectorLabel, companyIndustries, packaging]);

  const applySectorIndustryPreset = (map: EnabledModulesMap) => {
    const next: EnabledModulesMap = { ...map };
    for (const opt of listCompanyModuleOptions()) {
      if (opt.alwaysOn) next[opt.id] = true;
    }
    setEnabled(next);
    setDirty(true);
    void persist(next);
  };

  const draftIndustries = useMemo(
    () => industriesForSector(draftSector || null),
    [draftSector]
  );
  const draftSelectedIndustryDefs = useMemo(
    () =>
      draftIndustryIds
        .map((id) => getIndustry(id))
        .filter(Boolean) as NonNullable<ReturnType<typeof getIndustry>>[],
    [draftIndustryIds]
  );
  const draftBusinessTypeOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ id: string; label: string }> = [];
    for (const ind of draftSelectedIndustryDefs) {
      for (const bt of ind.businessTypes) {
        if (seen.has(bt.id)) continue;
        seen.add(bt.id);
        out.push({ id: bt.id, label: bt.label });
      }
    }
    return out;
  }, [draftSelectedIndustryDefs]);

  const saveClassification = async () => {
    if (!draftSector) {
      toast.error('Select a sector');
      return;
    }
    if (!draftIndustryIds.length) {
      toast.error('Select at least one industry');
      return;
    }
    setClassifying(true);
    try {
      // Suggest packs from selected industries
      const industryPacks = draftIndustryIds.flatMap(
        (id) => getIndustry(id)?.packIds || []
      );
      const nextPacks = [
        ...new Set([...selectedPacks, ...industryPacks]),
      ];
      const res = await fetch('/api/business/packaging', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          sectorId: draftSector,
          industryIds: draftIndustryIds,
          industryId: draftIndustryIds[0] || null,
          businessTypeIds: draftBusinessTypeIds,
          businessTypeId: draftBusinessTypeIds[0] || null,
          packIds: nextPacks,
          moduleIds: packaging?.moduleIds || [],
          entityTypeId: packaging?.entityTypeId,
          suggestIndustryPacks: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      toast.success(
        'Sector & industries saved — company profile updated'
      );
      window.dispatchEvent(new Event('sa:company-changed'));
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setClassifying(false);
    }
  };

  const togglePack = (packId: string) => {
    setSelectedPacks((prev) => {
      const has = prev.includes(packId);
      return has ? prev.filter((x) => x !== packId) : [...prev, packId];
    });
    setPacksDirty(true);
  };

  const payForNewPacks = async () => {
    const prev = new Set(packaging?.packIds || []);
    const added = selectedPacks.filter((id) => !prev.has(id));
    if (!added.length) {
      toast.message('No new packs to pay for');
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
          months: String(q.months),
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
            await fetch('/api/business/packaging', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({
                companyId,
                packIds: selectedPacks,
                moduleIds: packaging?.moduleIds || [],
                entityTypeId: packaging?.entityTypeId,
                sectorId: packaging?.sectorId || draftSector,
                industryIds: draftIndustryIds.length
                  ? draftIndustryIds
                  : packaging?.industryIds,
                suggestIndustryPacks: true,
              }),
            });
            toast.success(
              data.channel === 'apple_pay'
                ? `Packs activated via Apple Pay · R${q.payZar}`
                : `Packs activated · R${q.payZar}`
            );
            setPacksDirty(false);
            window.dispatchEvent(new Event('sa:company-changed'));
            await load();
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

  const savePacks = async () => {
    setSaving(true);
    try {
      const prev = new Set(packaging?.packIds || []);
      const added = selectedPacks.filter((id) => !prev.has(id));
      if (added.length > 0 && newPacksQuote.payCents > 0) {
        const pay = confirm(
          `You added ${added.length} Industry Pack(s) (R${newPacksQuote.payZar}/mo).\n\nOK = Pay now (Paystack)\nCancel = Save selection without charging`
        );
        setSaving(false);
        if (pay) {
          await payForNewPacks();
          return;
        }
        setSaving(true);
      }

      const res = await fetch('/api/business/packaging', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          packIds: selectedPacks,
          moduleIds: packaging?.moduleIds || [],
          entityTypeId: packaging?.entityTypeId,
          sectorId: packaging?.sectorId || draftSector || 'secondary',
          industryIds:
            draftIndustryIds.length > 0
              ? draftIndustryIds
              : packaging?.industryIds,
          industryId:
            draftIndustryIds[0] || packaging?.industryId || null,
          businessTypeIds:
            draftBusinessTypeIds.length > 0
              ? draftBusinessTypeIds
              : packaging?.businessTypeIds,
          suggestIndustryPacks: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(data.message || 'Packs & modules updated');
      setPacksDirty(false);
      window.dispatchEvent(new Event('sa:company-changed'));
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (moduleId: string, on: boolean) => {
    if (isAlwaysOnModule(moduleId)) return;
    const map: EnabledModulesMap = {
      ...enabled,
      [moduleId]: on,
    };
    for (const opt of listCompanyModuleOptions()) {
      if (opt.alwaysOn) map[opt.id] = true;
    }
    setEnabled(map);
    setDirty(true);
    void persist(map, true).then(() => {
      toast.message(on ? `${moduleId} enabled` : `${moduleId} hidden`);
    });
  };

  const renderModuleToggle = (moduleId: string, showPackBadges?: boolean) => {
    const opt = optionsById.get(moduleId);
    if (!opt) return null;
    const on = enabled[opt.id] !== false;
    const viaPacks = showPackBadges
      ? packsUnlockingAppModule(opt.id).filter((p) => subscribedPackIds.has(p.id))
      : [];
    return (
      <li key={opt.id}>
        <label
          className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 cursor-pointer transition-all min-h-[4.5rem] ${
            on
              ? 'border-[#00b4d8]/45 bg-[#00b4d8]/5 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          } ${opt.alwaysOn ? 'opacity-95' : ''}`}
        >
          <input
            type="checkbox"
            className="mt-1 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8] shrink-0"
            checked={on}
            disabled={opt.alwaysOn || saving || govLocked}
            onChange={(e) => toggle(opt.id, e.target.checked)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-900">
              {opt.name}
              {opt.alwaysOn ? (
                <span className="ml-1.5 text-[9px] font-black uppercase tracking-wide text-neutral-400">
                  always on
                </span>
              ) : null}
            </span>
            <span className="block text-[11px] text-neutral-500 leading-snug mt-0.5">
              {opt.description}
            </span>
            {viaPacks.length > 0 ? (
              <span className="mt-1.5 flex flex-wrap gap-1">
                {viaPacks.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800"
                  >
                    via {p.shortName}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </label>
      </li>
    );
  };

  if (loading) {
    return (
      <BusinessPage>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </BusinessPage>
    );
  }

  return (
    <BusinessPage>
      <BusinessHeader
        title="Workspace"
        titleAccent="modules"
        description={`${tradingName || 'Your company'} — modules you turn on here are what the team can open after login (Control Tower, FitAdvisor, FieldAdvisor, QuarryAdvisor, DBE, core hubs). Fine-tune per person under Team. Set sector/packs below, then toggle hubs.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/my-business/team"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" /> Per-user modules
            </Link>
            {packsDirty ? (
              <button
                type="button"
                disabled={saving || paying || govLocked}
                onClick={() => void savePacks()}
                className="btn-primary !py-2.5 !px-4 text-sm"
              >
                {saving || paying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
                Save packs
                {newPacksQuote.packCount
                  ? ` · +R${newPacksQuote.payZar}`
                  : ''}
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void persist(enabled)}
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save hubs
            </button>
          </div>
        }
      />

      {govLocked ? (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
          {lockMessage ||
            'Programme modules for government departments are managed centrally and cannot be changed here.'}
          {platformOperator ? null : null}
        </div>
      ) : null}

      {/* Existing companies: set or change sector + industry */}
      <div
        className={`mb-6 rounded-3xl border p-5 sm:p-6 ${
          !yourSectorId || !companyIndustries.length
            ? 'border-amber-200 bg-amber-50/80'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#0077b6]">
              {!yourSectorId || !companyIndustries.length
                ? 'Action required · classification'
                : 'Your sector & industries'}
            </p>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {!yourSectorId || !companyIndustries.length
                ? 'Select sector and industries'
                : 'Update sector and industries'}
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Choose one sector and one or more industries. Saving updates
              Company → Identity (profile industries) as well.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Sector
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {OS_SECTORS.map((s) => {
                const on = draftSector === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={classifying || govLocked}
                    onClick={() => {
                      setDraftSector(s.id);
                      setDraftIndustryIds([]);
                      setDraftBusinessTypeIds([]);
                    }}
                    className={`text-left rounded-xl border-2 px-3 py-2.5 transition ${
                      on
                        ? 'border-[#00b4d8] bg-sky-50'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="text-sm font-bold text-slate-900">
                      {s.label}
                    </div>
                    <div className="text-[10px] text-neutral-500 line-clamp-2">
                      {s.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {draftSector ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Industries (one or more)
              </p>
              <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {draftIndustries.map((ind) => {
                  const on = draftIndustryIds.includes(ind.id);
                  return (
                    <button
                      key={ind.id}
                      type="button"
                      disabled={classifying || govLocked}
                      onClick={() => {
                        setDraftIndustryIds((prev) => {
                          const has = prev.includes(ind.id);
                          const next = has
                            ? prev.filter((x) => x !== ind.id)
                            : [...prev, ind.id];
                          setDraftBusinessTypeIds((bts) =>
                            bts.filter((btid) =>
                              next.some((iid) =>
                                Boolean(getBusinessType(iid, btid))
                              )
                            )
                          );
                          return next;
                        });
                      }}
                      className={`text-left rounded-xl border-2 px-3 py-2.5 transition ${
                        on
                          ? 'border-[#00b4d8] bg-sky-50'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-sm font-bold text-slate-900">
                        {on ? '✓ ' : ''}
                        {ind.label}
                      </div>
                      <div className="text-[10px] text-neutral-500 line-clamp-2">
                        {ind.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {draftSelectedIndustryDefs.length > 0 ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Business type(s) (optional · multi)
              </p>
              <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {draftBusinessTypeOptions.map((bt) => {
                  const on = draftBusinessTypeIds.includes(bt.id);
                  return (
                    <button
                      key={bt.id}
                      type="button"
                      disabled={classifying || govLocked}
                      onClick={() =>
                        setDraftBusinessTypeIds((prev) =>
                          prev.includes(bt.id)
                            ? prev.filter((x) => x !== bt.id)
                            : [...prev, bt.id]
                        )
                      }
                      className={`text-left rounded-xl border px-3 py-2 transition ${
                        on
                          ? 'border-[#00b4d8] bg-sky-50'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">
                        {on ? '✓ ' : ''}
                        {bt.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={
              classifying ||
              govLocked ||
              !draftSector ||
              !draftIndustryIds.length
            }
            onClick={() => void saveClassification()}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {classifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save sector & industries
          </button>
        </div>
      </div>

      {/* Subscriptions + packaging summary */}
      <div className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/60 to-cyan-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-[#00b4d8]/15 flex items-center justify-center">
            <Package className="w-5 h-5 text-[#0077b6]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#0077b6]">
              Your plan · sector & packs
            </p>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {sectorLabel}
              {companyIndustries.length ? (
                <>
                  <span className="text-neutral-400 font-bold"> · </span>
                  {companyIndustries.map((i) => i.label).join(' · ')}
                </>
              ) : null}
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              {companyBusinessType
                ? `Business type: ${companyBusinessType.label}. `
                : entityLabel !== 'Not set'
                  ? `Entity: ${entityLabel}. `
                  : ''}
              Showing modules and Industry Packs for your registered sector
              {companyIndustries.length > 1
                ? ` and ${companyIndustries.length} industries`
                : ''}
              . Core OS is always included.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black tabular-nums text-[#00b4d8]">
              {counts.on}
              <span className="text-sm text-neutral-400 font-bold">
                /{counts.optional}
              </span>
            </div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wide">
              optional on
            </div>
            {configured ? (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700">
                <CheckCircle2 className="w-3 h-3" /> Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-700">
                <Sparkles className="w-3 h-3" /> Pick a preset
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Core OS · R{CORE_OS_MONTHLY_ZAR}/mo
          </span>
          {subscribedPacks.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">
              No Industry Packs subscribed yet
            </span>
          ) : (
            subscribedPacks.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#00b4d8]/35 bg-white px-3 py-1.5 text-xs font-bold text-[#0077b6]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {p.shortName}
                <span className="font-semibold text-neutral-500">
                  · R{p.monthlyZar}/mo
                </span>
              </span>
            ))
          )}
          {packBilling.paidUntil ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                paidActive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Packs paid until{' '}
              {new Date(packBilling.paidUntil).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
              {packBilling.channel ? ` · ${packBilling.channel}` : ''}
              {!paidActive ? ' · renew' : ''}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-600 font-semibold">
            Est. R{packPrice.total}/mo
            <span className="text-neutral-400 font-normal">
              {' '}
              (Core R{packPrice.core}
              {packPrice.packCount
                ? ` + ${packPrice.packCount}×R${INDUSTRY_PACK_MONTHLY_ZAR}`
                : ''}
              )
            </span>
          </span>
          <Link
            href="/dashboard/my-business/billing"
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4" /> Billing
          </Link>
        </div>
      </div>

      {/* Journey + presets */}
      <div className="mb-6 grid md:grid-cols-3 gap-3">
        <Link
          href="/dashboard/my-business/profile"
          className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/40 transition-colors"
        >
          <Building2 className="w-5 h-5 text-[#00b4d8] mb-2" />
          <div className="text-sm font-bold text-slate-900">1. Your identity</div>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Complete profile so partners trust you.
          </p>
        </Link>
        <div className="rounded-2xl border border-[#00b4d8]/30 bg-[#00b4d8]/5 p-4 ring-1 ring-[#00b4d8]/15">
          <LayoutGrid className="w-5 h-5 text-[#0077b6] mb-2" />
          <div className="text-sm font-bold text-slate-900">2. Modules (you are here)</div>
          <p className="text-[11px] text-neutral-600 mt-0.5">
            Core OS + sector packs — hide noise in the sidebar.
          </p>
        </div>
        <Link
          href="/dashboard/invite-business"
          className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/40 transition-colors"
        >
          <Network className="w-5 h-5 text-emerald-600 mb-2" />
          <div className="text-sm font-bold text-slate-900">3. Invite partners</div>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Start a customer/supplier — they finish onboarding.
          </p>
        </Link>
      </div>

      {sectorIndustryPresets.length > 0 ? (
        <div className="mb-6 rounded-3xl border border-neutral-200 bg-white p-5">
          <SectionLabel>Quick presets</SectionLabel>
          <p className="text-xs text-neutral-500 mt-1 mb-2">
            Only your registered sector
            {companyIndustries.length ? ' and industries' : ''} — not the full
            preset catalogue.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {sectorIndustryPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={saving || govLocked}
                onClick={() => applySectorIndustryPreset(p.map)}
                className="rounded-2xl border border-neutral-100 bg-neutral-50/80 p-3.5 text-left shadow-sm hover:border-[#00b4d8]/40 hover:bg-white hover:shadow-md transition-all"
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">
                  {p.id.startsWith('sector:') ? 'Sector' : 'Industry'}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {p.label}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                  {p.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Quick presets appear after you set a sector and industry above (or
          during onboarding).
        </div>
      )}

      {/* Workspace modules — Core first, then sector & industry */}
      <div className="mb-2 flex items-center gap-2">
        <Layers className="w-4 h-4 text-[#0077b6]" />
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
          Workspace modules
        </h3>
        <span className="text-[11px] text-neutral-500">
          Core OS · R{CORE_OS_MONTHLY_ZAR}/mo
        </span>
      </div>
      <p className="text-xs text-neutral-500 mb-5 max-w-2xl">
        Core platform hubs first, then industry verticals. Toggle what appears in
        the sidebar. Pack-unlocked hubs show a green badge when subscribed.
      </p>

      {MODULE_BANDS.map((band) => {
        const cats = MODULE_CATEGORIES.filter((c) => c.band === band.id);
        const bandOn = cats.reduce((n, cat) => {
          return (
            n +
            cat.moduleIds.filter(
              (id) => optionsById.get(id) && enabled[id] !== false
            ).length
          );
        }, 0);
        const bandTotal = cats.reduce((n, cat) => {
          return n + cat.moduleIds.filter((id) => optionsById.get(id)).length;
        }, 0);
        return (
          <div key={band.id} className="mb-8">
            <div
              className={`rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-2 ${
                band.id === 'core'
                  ? 'bg-slate-900 text-white'
                  : 'bg-[#0077b6] text-white'
              }`}
            >
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/70">
                  {band.id === 'core' ? '01 · Platform' : '02 · Verticals'}
                </div>
                <div className="text-lg font-black tracking-tight">
                  {band.title}
                </div>
                <p className="text-xs text-white/80 mt-0.5 max-w-xl">
                  {band.blurb}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-black tabular-nums">
                  {bandOn}
                  <span className="text-sm font-bold text-white/60">
                    /{bandTotal}
                  </span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-white/60">
                  on
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {cats.map((cat) => {
                const ids = cat.moduleIds.filter((id) => optionsById.get(id));
                if (!ids.length) return null;
                return (
                  <div key={cat.id}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-0.5">
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          {cat.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {cat.blurb}
                        </p>
                      </div>
                    </div>
                    <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                      {ids.map((id) => renderModuleToggle(id, true))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Sector industries (registered sector only) */}
      {yourSectorId && sectorIndustries.length > 0 ? (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0077b6]" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Industries in {sectorLabel}
            </h3>
          </div>
          <p className="text-xs text-neutral-500 mb-3 max-w-2xl">
            Your registered industry is highlighted. Packs below match this sector.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {sectorIndustries.map((ind) => {
              const yours = new Set(
                companyIndustries.map((i) => i.id)
              );
              const isYours = yours.has(ind.id);
              return (
                <div
                  key={ind.id}
                  className={`rounded-2xl border px-3.5 py-3 ${
                    isYours
                      ? 'border-[#00b4d8] bg-[#00b4d8]/5 ring-1 ring-[#00b4d8]/25'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {ind.label}
                    </span>
                    {isYours ? (
                      <span className="text-[9px] font-black uppercase tracking-wide text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                    {ind.description}
                  </p>
                  {ind.packIds.length ? (
                    <p className="text-[10px] font-semibold text-neutral-600 mt-1">
                      Packs:{' '}
                      {ind.packIds
                        .map((id) => getIndustryPack(id)?.shortName || id)
                        .join(', ')}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Sector + Industry Packs (registered sector only; programmes under Public Sector) */}
      <div className="mt-8 mb-2 flex items-center gap-2">
        <Package className="w-4 h-4 text-[#0077b6]" />
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
          {sectorLabel !== 'Not set' ? `${sectorLabel} · Industry packs` : 'Industry packs'}
        </h3>
        <span className="text-[11px] text-neutral-500">
          +R{INDUSTRY_PACK_MONTHLY_ZAR}/mo each
        </span>
      </div>
      <p className="text-xs text-neutral-500 mb-4 max-w-2xl">
        {yourSectorId
          ? `Select packs for ${sectorLabel}, then Save packs. Packs unlock recommended hubs below (and Core OS modules further up).`
          : 'Set sector & industries above first so we can show the right packs.'}
        {yourSectorId === 'public_sector'
          ? ' Public Sector: National · Provincial · Municipal · Local.'
          : ''}
      </p>

      {packsDirty ? (
        <div className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-cyan-950">
            <strong>Pack selection changed.</strong>
            {newPacksQuote.packCount
              ? ` +${newPacksQuote.packCount} pack(s) · R${newPacksQuote.payZar}/mo.`
              : ' Save to apply.'}
          </p>
          <button
            type="button"
            disabled={saving || paying || govLocked}
            onClick={() => void savePacks()}
            className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
          >
            {saving || paying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save packs
          </button>
        </div>
      ) : null}

      {!yourSectorId ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No sector yet — complete <strong>Sector & industries</strong> at the
          top of this page so packs and industry modules match your business.
        </div>
      ) : null}

      {orderedSectorGroups.map((group) => {
        const isYours = yourSectorId === group.sectorId;
        const isPublicSector = group.sectorId === 'public_sector';
        const yourTier = publicSectorTierForEntity(
          packaging?.entityTypeId || null
        );
        const publicModuleIds = [
          ...new Set(
            PUBLIC_SECTOR_TIERS.flatMap((t) =>
              t.programmes.flatMap((p) => [...p.moduleIds])
            )
          ),
        ];
        const programmesOn = publicModuleIds.filter(
          (id) => enabled[id] !== false && optionsById.get(id)
        ).length;
        return (
          <div key={group.sectorId} className="mb-6">
            <div
              className={`rounded-2xl px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-2 ${
                isYours
                  ? 'bg-[#0077b6] text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
                  {isYours ? 'Your sector' : 'Sector'}
                </div>
                <div className="text-base font-black">{group.sectorLabel}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    isYours ? 'text-white/80' : 'text-neutral-500'
                  }`}
                >
                  {group.sectorDescription}
                </div>
              </div>
              <div
                className={`text-xs font-bold text-right ${
                  isYours ? 'text-white/90' : 'text-neutral-600'
                }`}
              >
                <div>
                  {
                    group.packs.filter((p) => subscribedPackIds.has(p.id)).length
                  }
                  /{group.packs.length} pack
                  {group.packs.length === 1 ? '' : 's'} subscribed
                </div>
                {isPublicSector ? (
                  <div className="mt-0.5 opacity-90">
                    {programmesOn}/{publicModuleIds.length} programme hubs on
                    {yourTier ? ` · you: ${yourTier}` : ''}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4">
              {/* Public Sector spheres — only the company's tier when known */}
              {isPublicSector
                ? PUBLIC_SECTOR_TIERS.filter((tier) =>
                    yourTier ? tier.id === yourTier : true
                  ).map((tier) => {
                    const tierIsYours = yourTier === tier.id;
                    const tierModuleIds = [
                      ...new Set(
                        tier.programmes.flatMap((p) => [...p.moduleIds])
                      ),
                    ];
                    const tierOn = tierModuleIds.filter(
                      (id) =>
                        enabled[id] !== false && optionsById.get(id)
                    ).length;
                    return (
                      <div
                        key={tier.id}
                        className={`rounded-3xl border bg-white overflow-hidden ${
                          tierIsYours
                            ? 'border-violet-400 ring-2 ring-violet-200'
                            : 'border-violet-200'
                        }`}
                      >
                        <div
                          className={`flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b ${
                            tierIsYours
                              ? 'bg-violet-100/80 border-violet-200'
                              : 'bg-violet-50/40 border-violet-100'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                Public sector
                              </span>
                              <h4 className="text-base font-black text-slate-900">
                                {tier.label}
                              </h4>
                              {tierIsYours ? (
                                <span className="inline-flex items-center rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                                  Your tier
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed max-w-2xl">
                              {tier.description}
                            </p>
                            <p className="text-[11px] font-semibold text-neutral-600 mt-1.5">
                              {tierOn}/{tierModuleIds.length} hubs enabled ·{' '}
                              {tier.programmes.length} programme
                              {tier.programmes.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>

                        <div className="divide-y divide-neutral-100">
                          {tier.programmes.map((prog) => (
                            <div key={prog.id} className="p-4 sm:p-5">
                              <div className="mb-2">
                                <h5 className="text-sm font-black text-slate-900">
                                  {prog.name}
                                </h5>
                                <p className="text-[11px] text-neutral-500 leading-relaxed mt-0.5 max-w-2xl">
                                  {prog.description}
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {prog.chips.map((c) => (
                                    <span
                                      key={c}
                                      className="rounded-full px-2 py-0.5 text-[10px] font-bold border bg-white border-violet-200 text-violet-900"
                                    >
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">
                                {prog.moduleIds.map((id) =>
                                  renderModuleToggle(id, true)
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>

                        {/* Full SA national department catalogue */}
                        {tier.id === 'national' ? (
                          <div className="border-t border-violet-100 bg-slate-50/60 p-4 sm:p-5">
                            <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                  South Africa · National departments
                                </div>
                                <p className="text-xs text-neutral-600 mt-0.5 max-w-2xl">
                                  Full Cabinet portfolio list. Featured departments
                                  (DoE, DHET, DoH, Treasury) have dedicated programmes
                                  above; enable recommended hubs for any department
                                  below.
                                </p>
                              </div>
                              <span className="text-[11px] font-bold text-neutral-500">
                                {SA_NATIONAL_DEPARTMENTS.length} departments
                              </span>
                            </div>
                            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                              {SA_NATIONAL_DEPARTMENTS.map((dept) => {
                                const featured =
                                  'featured' in dept && Boolean(dept.featured);
                                const hubNames = (dept.moduleIds || [])
                                  .map((id) => optionsById.get(id)?.name || id)
                                  .join(' · ');
                                return (
                                  <div
                                    key={dept.id}
                                    className={`rounded-2xl border bg-white p-3 ${
                                      featured
                                        ? 'border-violet-300 ring-1 ring-violet-100'
                                        : 'border-neutral-200'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      <span className="text-[10px] font-black uppercase tracking-wide text-violet-800 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
                                        {dept.abbr}
                                      </span>
                                      {featured ? (
                                        <span className="text-[9px] font-bold uppercase text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                          Featured
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 leading-snug">
                                      {dept.name}
                                    </div>
                                    <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                                      {dept.focus}
                                    </p>
                                    {hubNames ? (
                                      <p className="text-[10px] font-semibold text-neutral-600 mt-1.5">
                                        Suggested hubs: {hubNames}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                : null}

              {group.packs.map((pack) => {
                const subscribed = subscribedPackIds.has(pack.id);
                const selected = selectedPackIds.has(pack.id);
                const unlockIds = appModulesUnlockedByPack(pack);
                return (
                  <div
                    key={pack.id}
                    className={`rounded-3xl border bg-white overflow-hidden ${
                      subscribed
                        ? 'border-emerald-300 ring-1 ring-emerald-100'
                        : selected
                          ? 'border-[#00b4d8] ring-1 ring-[#00b4d8]/25'
                          : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-neutral-100">
                      <label className="min-w-0 flex items-start gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8] shrink-0"
                          checked={selected}
                          disabled={saving || paying || govLocked}
                          onChange={() => togglePack(pack.id)}
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-base font-black text-slate-900">
                              {pack.name}
                            </span>
                            {subscribed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                Subscribed
                              </span>
                            ) : selected ? (
                              <span className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                                Selected
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-neutral-50 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                                Off
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-neutral-500 leading-relaxed max-w-xl">
                            {pack.description}
                          </span>
                          <span className="block text-[11px] font-semibold text-neutral-600 mt-1.5">
                            R{pack.monthlyZar}/mo · unlocks {unlockIds.length}{' '}
                            hub
                            {unlockIds.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {subscribed ? (
                          <Link
                            href="/dashboard/my-business/billing"
                            className="btn-secondary !py-2 !px-3 text-xs"
                          >
                            Billing
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    {/* Pack feature modules (industry definition) */}
                    <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-b border-neutral-100">
                      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
                        Pack includes
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {pack.modules.map((m) => (
                          <span
                            key={m.id}
                            title={m.description}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                              subscribed
                                ? 'bg-white border-emerald-200 text-emerald-900'
                                : 'bg-white border-neutral-200 text-neutral-600'
                            }`}
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* App hubs unlocked */}
                    <div className="p-4 sm:p-5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
                        Workspace hubs unlocked
                        {!subscribed ? (
                          <span className="ml-2 font-semibold normal-case tracking-normal text-amber-700">
                            — subscribe to activate recommended hubs
                          </span>
                        ) : null}
                      </div>
                      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                        {unlockIds.map((id) => renderModuleToggle(id, false))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
        <h3 className="font-black text-slate-900 text-lg mb-1">
          Inviting another company?
        </h3>
        <p className="text-sm text-neutral-600 leading-relaxed max-w-2xl mb-4">
          From Suppliers or Customers you can add a partner to your book and send a
          platform invite. They sign up, complete{' '}
          <strong>their</strong> Company profile, pick <strong>their</strong> modules,
          invite their team, and trade with you — without losing the link you already
          created.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/suppliers/add"
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" /> Add supplier
          </Link>
          <Link
            href="/dashboard/customers/onboard"
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" /> Add customer
          </Link>
          <Link
            href="/dashboard/invite-business"
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            Invite business <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard/my-business/team"
            className="btn-secondary !py-2.5 !px-4 text-sm"
          >
            Invite team
          </Link>
        </div>
      </div>
    </BusinessPage>
  );
}
