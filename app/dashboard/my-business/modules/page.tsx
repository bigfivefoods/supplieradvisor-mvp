'use client';

/**
 * Company → Modules — choose which workspace modules appear in the sidebar.
 * First-class onboarding step; presets for starter / trading / ops / full.
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
  MODULE_PRESETS,
  countEnabledOptionalModules,
  enabledModulesFromPreset,
  extractEnabledModulesFromMetadata,
  hasModulesConfigured,
  isAlwaysOnModule,
  listCompanyModuleOptions,
  mergeEnabledModulesIntoMetadata,
  normalizeEnabledModules,
  type EnabledModulesMap,
  type ModulePresetId,
} from '@/lib/business/company-modules';

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/profile?${params}`);
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

  const counts = useMemo(
    () => countEnabledOptionalModules(enabled),
    [enabled]
  );
  const configured = hasModulesConfigured(metadata);

  const persist = async (map: EnabledModulesMap, silent?: boolean) => {
    if (!privyUserId) {
      toast.error('Sign in required');
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

  const applyPreset = (id: ModulePresetId) => {
    const map = enabledModulesFromPreset(id);
    setEnabled(map);
    setDirty(true);
    void persist(map);
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

  const optionsById = useMemo(() => {
    const m = new Map(listCompanyModuleOptions().map((o) => [o.id, o]));
    return m;
  }, []);

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
        description={`${tradingName || 'Your company'} — choose which capabilities appear in the sidebar. Partners you invite complete their own company the same way.`}
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

      {/* Journey strip */}
      <div className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/60 to-cyan-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-[#00b4d8]/15 flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-[#0077b6]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#0077b6]">
              Company setup · step modules
            </p>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Shape the workspace for how you trade
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Turn on only what your company needs. You can invite a customer or
              supplier to SupplierAdvisor — they finish their own profile, modules,
              team, and billing. Your book stays linked when they claim.
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

        <SectionLabel>Quick presets</SectionLabel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
          {MODULE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={saving}
              onClick={() => applyPreset(p.id)}
              className="rounded-2xl border border-white bg-white/95 p-3.5 text-left shadow-sm hover:border-[#00b4d8]/40 hover:shadow-md transition-all"
            >
              <div className="text-sm font-bold text-slate-900">{p.label}</div>
              <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Partner invite callout */}
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
            Enable trade, ops, finance — hide noise.
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

      {MODULE_CATEGORIES.map((cat) => {
        const opts = cat.moduleIds
          .map((id) => optionsById.get(id))
          .filter(Boolean) as ReturnType<typeof listCompanyModuleOptions>;
        if (!opts.length) return null;
        return (
          <Panel
            key={cat.id}
            title={cat.title}
            className="mb-4"
          >
            <div className="px-4 pt-2 pb-1">
              <p className="text-xs text-neutral-500 leading-relaxed">{cat.blurb}</p>
            </div>
            <ul className="p-4 pt-2 grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {opts.map((opt) => {
                const on = enabled[opt.id] !== false;
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
                        disabled={opt.alwaysOn || saving}
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
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Panel>
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
