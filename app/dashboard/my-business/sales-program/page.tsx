'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  Handshake,
  Shield,
  Percent,
  ListChecks,
  Info,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import type { CommissionTier } from '@/lib/sales-contractor/commission';
import { formatZar, formatZarPrecise } from '@/lib/sales-contractor/commission';
import type { ProgramCriterion, SalesProgramSettings } from '@/lib/sales-program';

type Sample = {
  amount: number;
  commission: number;
  effectiveRatePct: number;
};

const emptyCriterion = (): ProgramCriterion => ({
  key: `c${Date.now()}`,
  title: '',
  detail: '',
  required: true,
});

export default function SalesProgramPage() {
  return (
    <CompanyRequired>
      <SalesProgramInner />
    </CompanyRequired>
  );
}

function SalesProgramInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const { role, canFinanceCritical } = useCompanyRole();
  const canEdit =
    canFinanceCritical || role === 'owner' || role === 'admin' || role === 'finance';

  const [settings, setSettings] = useState<SalesProgramSettings | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<
    'info' | 'legal' | 'commission' | 'sales' | 'reseller'
  >('info');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        ensure: '1',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/sales/program-settings?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSettings(data.settings);
      setSamples(data.samples || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!settings || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sales/program-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          program_name: settings.program_name,
          program_summary: settings.program_summary,
          is_enabled: settings.is_enabled,
          contract_title: settings.contract_title,
          contract_version: settings.contract_version,
          legal_body_html: settings.legal_body_html,
          legal_addendum_html: settings.legal_addendum_html,
          email_domain: settings.email_domain,
          require_re_sign_on_change: settings.require_re_sign_on_change,
          commission_tiers: settings.commission_tiers,
          min_commission_pct: settings.min_commission_pct,
          max_commission_pct: settings.max_commission_pct,
          currency: settings.currency,
          example_units: settings.example_units,
          example_unit_price: settings.example_unit_price,
          example_label: settings.example_label,
          sales_criteria: settings.sales_criteria,
          reseller_criteria: settings.reseller_criteria,
          eligibility_notes: settings.eligibility_notes,
          program_info_html: settings.program_info_html,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSettings(data.settings);
      toast.success('Sales program saved — new contractors will use these terms');
      // refresh samples
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof SalesProgramSettings>(
    key: K,
    value: SalesProgramSettings[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateTier = (index: number, patch: Partial<CommissionTier>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const tiers = prev.commission_tiers.map((t, i) =>
        i === index ? { ...t, ...patch } : t
      );
      return { ...prev, commission_tiers: tiers };
    });
  };

  const addTier = () => {
    setSettings((prev) => {
      if (!prev) return prev;
      const tiers = [...prev.commission_tiers];
      // Insert before last open-ended tier
      const last = tiers[tiers.length - 1];
      const prevUp =
        tiers.length >= 2 ? Number(tiers[tiers.length - 2].upTo || 0) : 100_000;
      const mid = last?.upTo == null ? prevUp * 2 : Number(last.upTo);
      tiers.splice(tiers.length - 1, 0, {
        upTo: mid,
        ratePct: last?.ratePct ? Math.max(0, last.ratePct - 1) : 5,
        label: 'New band',
      });
      return { ...prev, commission_tiers: tiers };
    });
  };

  const removeTier = (index: number) => {
    setSettings((prev) => {
      if (!prev || prev.commission_tiers.length <= 1) return prev;
      const tiers = prev.commission_tiers.filter((_, i) => i !== index);
      // Ensure last is open
      if (tiers.length) {
        tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], upTo: null };
      }
      return { ...prev, commission_tiers: tiers };
    });
  };

  const updateCriterion = (
    field: 'sales_criteria' | 'reseller_criteria',
    index: number,
    patch: Partial<ProgramCriterion>
  ) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const list = prev[field].map((c, i) =>
        i === index ? { ...c, ...patch } : c
      );
      return { ...prev, [field]: list };
    });
  };

  const addCriterion = (field: 'sales_criteria' | 'reseller_criteria') => {
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: [...prev[field], emptyCriterion()] };
    });
  };

  const removeCriterion = (
    field: 'sales_criteria' | 'reseller_criteria',
    index: number
  ) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: prev[field].filter((_, i) => i !== index) };
    });
  };

  if (loading || !settings) {
    return (
      <BusinessPage>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </BusinessPage>
    );
  }

  const tabs = [
    { id: 'info' as const, label: 'Program info', icon: Info },
    { id: 'legal' as const, label: 'Legal', icon: Shield },
    { id: 'commission' as const, label: 'Commission', icon: Percent },
    { id: 'sales' as const, label: 'Sales criteria', icon: ListChecks },
    { id: 'reseller' as const, label: 'Reseller criteria', icon: Handshake },
  ];

  return (
    <BusinessPage>
      <BusinessHeader
        title="Sales"
        titleAccent="program"
        description="Company-specific legal terms, commission structure, and sales/reseller criteria for your sales portal. Contractors sign and earn under these rules — personal sales only (not multi-level marketing)."
        action={
          canEdit ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save program
            </button>
          ) : (
            <span className="text-xs text-slate-500">View only — owner/admin/finance can edit</span>
          )
        }
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 sm:px-5 text-sm text-amber-950 mb-4 leading-relaxed">
        <strong>Personal sales only.</strong> Commission is always limited to sales each
        contractor personally generates. Multi-level / downline / connection-of-connection pay
        is disabled platform-wide and cannot be turned off.
        {settings.using_defaults ? (
          <span className="block mt-1.5 text-amber-800">
            Showing platform defaults until you save (creates your company program row).
          </span>
        ) : null}
        <span className="block mt-1.5 text-xs text-amber-800 break-words">
          Version <strong className="break-all">{settings.contract_version}</strong>
          {settings.require_re_sign_on_change
            ? ' · material changes auto-bump version for new signings'
            : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold border transition whitespace-nowrap ${
              tab === t.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5 shrink-0" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-w-0 space-y-4">
        {tab === 'info' && (
          <Panel className="p-4 sm:p-5 md:p-6">
            <div className="space-y-4 min-w-0">
              <label className="block min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Program name
                </span>
                <input
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={settings.program_name}
                  disabled={!canEdit}
                  onChange={(e) => update('program_name', e.target.value)}
                />
              </label>
              <label className="block min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Short summary (invites &amp; portal)
                </span>
                <textarea
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[96px] leading-relaxed"
                  value={settings.program_summary}
                  disabled={!canEdit}
                  onChange={(e) => update('program_summary', e.target.value)}
                />
              </label>
              <label className="block min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  How the program works (HTML optional)
                </span>
                <textarea
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[110px] font-mono text-xs leading-relaxed"
                  value={settings.program_info_html || ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update('program_info_html', e.target.value || null)
                  }
                  placeholder="<p>Explain territories, products, onboarding…</p>"
                />
              </label>
              <label className="block min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Eligibility notes
                </span>
                <textarea
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[80px] leading-relaxed"
                  value={settings.eligibility_notes || ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update('eligibility_notes', e.target.value || null)
                  }
                  placeholder="Territories, product lines, discount caps…"
                />
              </label>
              <label className="flex items-start gap-2.5 text-sm leading-snug">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={settings.is_enabled}
                  disabled={!canEdit}
                  onChange={(e) => update('is_enabled', e.target.checked)}
                />
                <span>Program enabled (visible for contractors)</span>
              </label>
            </div>
          </Panel>
        )}

        {tab === 'legal' && (
          <Panel className="p-4 sm:p-5 md:p-6">
            <div className="space-y-4 min-w-0">
              <label className="block min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contract title
                </span>
                <input
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={settings.contract_title}
                  disabled={!canEdit}
                  onChange={(e) => update('contract_title', e.target.value)}
                />
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contract version
                  </span>
                  <input
                    className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono break-all"
                    value={settings.contract_version}
                    disabled={!canEdit}
                    onChange={(e) => update('contract_version', e.target.value)}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Corporate email domain
                  </span>
                  <input
                    className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={settings.email_domain || ''}
                    disabled={!canEdit}
                    onChange={(e) =>
                      update('email_domain', e.target.value || null)
                    }
                    placeholder="yourcompany.co.za"
                  />
                </label>
              </div>
              <label className="block min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 leading-snug">
                  Company addendum (appended to platform template — recommended)
                </span>
                <textarea
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[130px] font-mono text-xs leading-relaxed"
                  value={settings.legal_addendum_html || ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update('legal_addendum_html', e.target.value || null)
                  }
                  placeholder="<p>Extra company policies, product-specific rules…</p>"
                />
              </label>
              <label className="block min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 leading-snug block">
                  Full custom legal body (advanced — replaces platform template; anti-MLM still forced)
                </span>
                <textarea
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[170px] font-mono text-xs leading-relaxed"
                  value={settings.legal_body_html || ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update('legal_body_html', e.target.value || null)
                  }
                  placeholder="Leave blank to use the standard SA independent contractor + NDA template."
                />
              </label>
              <label className="flex items-start gap-2.5 text-sm leading-snug">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={settings.require_re_sign_on_change}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update('require_re_sign_on_change', e.target.checked)
                  }
                />
                <span>
                  Auto-bump version when legal or commission changes (new signings)
                </span>
              </label>
            </div>
          </Panel>
        )}

        {tab === 'commission' && (
          <div className="space-y-4 min-w-0">
            <Panel className="p-4 sm:p-5 md:p-6">
              <div className="space-y-4 min-w-0">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Stepped scale: the whole deal is paid at one rate based on deal size. The last
                  tier must be open-ended (no upper limit).
                </p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 pr-3 font-semibold">Up to (ZAR)</th>
                        <th className="py-2.5 pr-3 font-semibold">Rate %</th>
                        <th className="py-2.5 pr-3 font-semibold">Label</th>
                        <th className="py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {settings.commission_tiers.map((t, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-2.5 pr-3 align-middle">
                            {i === settings.commission_tiers.length - 1 ? (
                              <span className="text-slate-500 text-xs font-semibold whitespace-nowrap">
                                Open (and above)
                              </span>
                            ) : (
                              <input
                                type="number"
                                className="w-full min-w-[7rem] rounded-lg border border-slate-200 px-2.5 py-2"
                                value={t.upTo ?? ''}
                                disabled={!canEdit}
                                onChange={(e) =>
                                  updateTier(i, {
                                    upTo: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="py-2.5 pr-3 align-middle">
                            <input
                              type="number"
                              step="0.1"
                              className="w-20 rounded-lg border border-slate-200 px-2.5 py-2"
                              value={t.ratePct}
                              disabled={!canEdit}
                              onChange={(e) =>
                                updateTier(i, {
                                  ratePct: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td className="py-2.5 pr-3 align-middle min-w-0">
                            <input
                              className="w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2"
                              value={t.label || ''}
                              disabled={!canEdit}
                              onChange={(e) =>
                                updateTier(i, { label: e.target.value })
                              }
                            />
                          </td>
                          <td className="py-2.5 align-middle">
                            {canEdit &&
                            settings.commission_tiers.length > 1 &&
                            i < settings.commission_tiers.length - 1 ? (
                              <button
                                type="button"
                                onClick={() => removeTier(i)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                                aria-label="Remove band"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addTier}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0077b6]"
                  >
                    <Plus className="w-4 h-4" /> Add band
                  </button>
                )}
                <div className="grid sm:grid-cols-3 gap-4 pt-1">
                  <label className="block min-w-0">
                    <span className="text-xs font-semibold text-slate-500">
                      Example units
                    </span>
                    <input
                      type="number"
                      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      value={settings.example_units ?? ''}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(
                          'example_units',
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-xs font-semibold text-slate-500">
                      Unit price (ZAR)
                    </span>
                    <input
                      type="number"
                      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      value={settings.example_unit_price ?? ''}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(
                          'example_unit_price',
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-xs font-semibold text-slate-500">
                      Example label
                    </span>
                    <input
                      className="mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      value={settings.example_label || ''}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update('example_label', e.target.value || null)
                      }
                    />
                  </label>
                </div>
              </div>
            </Panel>
            {samples.length > 0 && (
              <Panel className="p-4 sm:p-5 md:p-6">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                    Live preview (saved rates)
                  </div>
                  <ul className="space-y-2 text-sm">
                    {samples.map((s) => (
                      <li
                        key={s.amount}
                        className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2"
                      >
                        <span className="text-slate-600">{formatZar(s.amount)}</span>
                        <span className="font-semibold text-[#0077b6] tabular-nums">
                          {formatZarPrecise(s.commission)}{' '}
                          <span className="text-slate-400 font-normal">
                            ({s.effectiveRatePct}%)
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>
            )}
          </div>
        )}

        {(tab === 'sales' || tab === 'reseller') && (
          <Panel className="p-4 sm:p-5 md:p-6">
            <div className="space-y-4 min-w-0">
              <p className="text-sm text-slate-600 leading-relaxed">
                {tab === 'sales'
                  ? 'Sales contractor KPIs / criteria appear in the agreement and portal. These are the only contractual performance measures for contractors.'
                  : 'Reseller criteria are shown to your team and resellers as eligibility / standards information (product commission rates stay on Containers → Resellers).'}
              </p>
              {(tab === 'sales'
                ? settings.sales_criteria
                : settings.reseller_criteria
              ).map((c, i) => (
                <div
                  key={c.key + i}
                  className="rounded-xl border border-slate-200 p-3.5 sm:p-4 space-y-2.5 min-w-0"
                >
                  <div className="flex gap-2 min-w-0 items-start">
                    <input
                      className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-semibold"
                      placeholder="Title"
                      value={c.title}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateCriterion(
                          tab === 'sales' ? 'sales_criteria' : 'reseller_criteria',
                          i,
                          { title: e.target.value }
                        )
                      }
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          removeCriterion(
                            tab === 'sales' ? 'sales_criteria' : 'reseller_criteria',
                            i
                          )
                        }
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded shrink-0"
                        aria-label="Remove criterion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    className="w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm min-h-[72px] leading-relaxed"
                    placeholder="Detail"
                    value={c.detail}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateCriterion(
                        tab === 'sales' ? 'sales_criteria' : 'reseller_criteria',
                        i,
                        { detail: e.target.value }
                      )
                    }
                  />
                </div>
              ))}
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    addCriterion(
                      tab === 'sales' ? 'sales_criteria' : 'reseller_criteria'
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0077b6]"
                >
                  <Plus className="w-4 h-4" /> Add criterion
                </button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </BusinessPage>
  );
}
