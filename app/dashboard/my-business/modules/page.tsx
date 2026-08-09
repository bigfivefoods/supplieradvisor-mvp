'use client';

/**
 * Company → Modules — workspace hubs grouped by Core OS + sector / industry packs.
 * Shows which Industry Packs the company has subscribed to.
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
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessPage,
  BusinessHeader,
} from '@/components/business/BusinessShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import {
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState<EnabledModulesMap>(() =>
    normalizeEnabledModules(null)
  );
  const [tradingName, setTradingName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [govLocked, setGovLocked] = useState(false);
  const [platformOperator, setPlatformOperator] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [draftSector, setDraftSector] = useState('');
  const [draftIndustry, setDraftIndustry] = useState('');
  const [draftBusinessType, setDraftBusinessType] = useState('');

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
    if (packaging?.industryId) setDraftIndustry(String(packaging.industryId));
    if (packaging?.businessTypeId)
      setDraftBusinessType(String(packaging.businessTypeId));
  }, [packaging?.sectorId, packaging?.industryId, packaging?.businessTypeId]);
  const packBilling = useMemo(
    () => readPackBillingFromMetadata(metadata),
    [metadata]
  );
  const subscribedPackIds = useMemo(
    () => new Set(packaging?.packIds || []),
    [packaging]
  );
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

  const companyIndustry = useMemo(
    () => getIndustry(packaging?.industryId || null),
    [packaging?.industryId]
  );
  const companyBusinessType = useMemo(
    () =>
      getBusinessType(
        packaging?.industryId || null,
        packaging?.businessTypeId || null
      ),
    [packaging?.industryId, packaging?.businessTypeId]
  );
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

    if (companyIndustry) {
      // Industry packs; merge any explicitly selected packaging packs
      const industryPacks = [
        ...new Set([
          ...companyIndustry.packIds,
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
      out.push({
        id: `industry:${companyIndustry.id}`,
        label: companyIndustry.label,
        description: packNames.length
          ? `Your industry modules · packs: ${packNames.join(', ')}.`
          : companyIndustry.description,
        map,
      });
    }

    return out;
  }, [yourSectorId, sectorLabel, companyIndustry, packaging]);

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
  const draftIndustryDef = useMemo(
    () => getIndustry(draftIndustry || null),
    [draftIndustry]
  );

  const saveClassification = async () => {
    if (!draftSector) {
      toast.error('Select a sector');
      return;
    }
    setClassifying(true);
    try {
      const res = await fetch('/api/business/packaging', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          sectorId: draftSector,
          industryId: draftIndustry || null,
          businessTypeId: draftBusinessType || null,
          packIds: packaging?.packIds || [],
          moduleIds: packaging?.moduleIds || [],
          entityTypeId: packaging?.entityTypeId,
          suggestIndustryPacks: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      toast.success('Sector & industry saved');
      window.dispatchEvent(new Event('sa:company-changed'));
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setClassifying(false);
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
        description={`${tradingName || 'Your company'} — modules grouped by Core OS, sector, and Industry Packs. Toggle what appears in the sidebar.`}
        action={
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void persist(enabled)}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
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
          !yourSectorId || !companyIndustry
            ? 'border-amber-200 bg-amber-50/80'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#0077b6]">
              {!yourSectorId || !companyIndustry
                ? 'Action required · classification'
                : 'Your sector & industry'}
            </p>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {!yourSectorId || !companyIndustry
                ? 'Select sector and industry'
                : 'Update sector and industry'}
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Already registered? Set these so Quick presets and Industry Packs
              match your business. You can change them anytime.
            </p>
          </div>
          <Link
            href="/dashboard/my-business/packaging"
            className="btn-secondary !py-2 !px-3 text-xs shrink-0"
          >
            Full packaging
          </Link>
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
                      setDraftIndustry('');
                      setDraftBusinessType('');
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
                Industry
              </p>
              <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {draftIndustries.map((ind) => {
                  const on = draftIndustry === ind.id;
                  return (
                    <button
                      key={ind.id}
                      type="button"
                      disabled={classifying || govLocked}
                      onClick={() => {
                        setDraftIndustry(ind.id);
                        setDraftBusinessType('');
                      }}
                      className={`text-left rounded-xl border-2 px-3 py-2.5 transition ${
                        on
                          ? 'border-[#00b4d8] bg-sky-50'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-sm font-bold text-slate-900">
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

          {draftIndustryDef ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Business type (optional)
              </p>
              <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {draftIndustryDef.businessTypes.map((bt) => {
                  const on = draftBusinessType === bt.id;
                  return (
                    <button
                      key={bt.id}
                      type="button"
                      disabled={classifying || govLocked}
                      onClick={() => setDraftBusinessType(bt.id)}
                      className={`text-left rounded-xl border px-3 py-2 transition ${
                        on
                          ? 'border-[#00b4d8] bg-sky-50'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">
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
            disabled={classifying || govLocked || !draftSector}
            onClick={() => void saveClassification()}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {classifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save sector & industry
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
              {companyIndustry ? (
                <>
                  <span className="text-neutral-400 font-bold"> · </span>
                  {companyIndustry.label}
                </>
              ) : null}
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              {companyBusinessType
                ? `Business type: ${companyBusinessType.label}. `
                : entityLabel !== 'Not set'
                  ? `Entity: ${entityLabel}. `
                  : ''}
              Showing modules and Industry Packs for your registered sector only.
              Core OS is always included.
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

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/my-business/packaging"
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4" /> Manage packs
          </Link>
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
            {companyIndustry ? ' and industry' : ''} — not the full preset
            catalogue.
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
          Quick presets appear after you set a sector (and industry) on{' '}
          <Link
            href="/dashboard/my-business/packaging"
            className="font-bold underline"
          >
            Packaging
          </Link>{' '}
          or during onboarding.
        </div>
      )}

      {/* Workspace modules — sectioned like Schools-DBE (Govern · Trade · Operate …) */}
      <div className="mb-2 flex items-center gap-2">
        <Layers className="w-4 h-4 text-[#0077b6]" />
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
          Workspace modules
        </h3>
        <span className="text-[11px] text-neutral-500">
          Core OS · R{CORE_OS_MONTHLY_ZAR}/mo
        </span>
      </div>
      <p className="text-xs text-neutral-500 mb-4 max-w-2xl">
        Grouped like Schools (Govern · Trade · Operate · Insights …). Toggle which
        hubs appear in the sidebar. Hubs unlocked by a subscribed pack show a
        green &ldquo;via pack&rdquo; badge.
      </p>

      {MODULE_CATEGORIES.map((cat) => {
        const opts = cat.moduleIds
          .map((id) => optionsById.get(id))
          .filter(Boolean) as ReturnType<typeof listCompanyModuleOptions>;
        if (!opts.length) return null;
        return (
          <div key={cat.id} className="mb-5">
            {/* Sticky-style section band (matches DBE sidebar section labels) */}
            <div className="rounded-2xl bg-slate-100 px-4 py-2.5 mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">
                  Section
                </div>
                <div className="text-base font-black text-slate-900 tracking-tight">
                  {cat.title}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 max-w-md text-right leading-snug">
                {cat.blurb}
              </p>
            </div>
            <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {opts.map((opt) => renderModuleToggle(opt.id, true))}
            </ul>
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
              const isYours = packaging?.industryId === ind.id;
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
                        Your industry
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
          ? `Only packs for your registered sector (${sectorLabel}) are shown.`
          : 'Set packaging on Company → Packaging so we can filter packs by sector.'}
        {yourSectorId === 'public_sector'
          ? ' Public Sector is National · Provincial · Municipal · Local (DBE provincial; schools local).'
          : ''}
      </p>

      {!yourSectorId ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No sector on this company yet.{' '}
          <Link
            href="/dashboard/my-business/packaging"
            className="font-bold underline"
          >
            Set packaging
          </Link>{' '}
          or complete onboarding so we can show the right industry modules.
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
                const unlockIds = appModulesUnlockedByPack(pack);
                return (
                  <div
                    key={pack.id}
                    className={`rounded-3xl border bg-white overflow-hidden ${
                      subscribed
                        ? 'border-emerald-300 ring-1 ring-emerald-100'
                        : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-neutral-100">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-base font-black text-slate-900">
                            {pack.name}
                          </h4>
                          {subscribed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Subscribed
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-neutral-50 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                              Not subscribed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 leading-relaxed max-w-xl">
                          {pack.description}
                        </p>
                        <p className="text-[11px] font-semibold text-neutral-600 mt-1.5">
                          R{pack.monthlyZar}/mo · {pack.modules.length} pack
                          feature
                          {pack.modules.length === 1 ? '' : 's'} · unlocks{' '}
                          {unlockIds.length} hub
                          {unlockIds.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {subscribed ? (
                          <Link
                            href="/dashboard/my-business/billing"
                            className="btn-secondary !py-2 !px-3 text-xs"
                          >
                            Billing
                          </Link>
                        ) : (
                          <Link
                            href="/dashboard/my-business/packaging"
                            className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                          >
                            Subscribe <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
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
