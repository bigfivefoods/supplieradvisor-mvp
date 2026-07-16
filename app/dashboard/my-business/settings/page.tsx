'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, AlertTriangle, Trash2 } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CURRENCIES,
  DEFAULT_SETTINGS,
  TIMEZONES,
  type CompanySettings,
} from '@/lib/business/types';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

export default function BusinessSettingsPage() {
  return (
    <CompanyRequired>
      <SettingsInner />
    </CompanyRequired>
  );
}

function SettingsInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const router = useRouter();

  const [tradingName, setTradingName] = useState('');
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const [res, delRes] = await Promise.all([
        fetch(`/api/business/settings?${params}`),
        fetch(`/api/business/company?companyId=${companyId}`),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setTradingName(data.trading_name || '');
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
      if (delRes.ok) {
        const d = await delRes.json();
        setCanDelete(Boolean(d.canDelete));
      } else {
        setCanDelete(false);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  const deleteCompany = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/business/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          companyId,
          privyUserId,
          confirmName,
          confirmPhrase,
          reason: deleteReason || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || 'Delete failed'
        );
      }
      try {
        localStorage.removeItem('selectedCompanyId');
        localStorage.removeItem('selectedCompanyName');
      } catch {
        /* ignore */
      }
      toast.success('Company deleted', {
        description: 'Switch to another company or register a new one.',
      });
      router.push('/dashboard/select-company');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (key: keyof CompanySettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/business/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          trading_name: tradingName,
          settings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || settings) });
      toast.success('Settings saved to Supabase');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
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
        title="Business"
        titleAccent="settings"
        description="Locale, currency, notifications, and network discoverability — synced to Supabase on every save."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Save settings
              </>
            )}
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 max-w-5xl">
        <Panel title="Locale & commercial">
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                Display name
              </label>
              <input
                className="input mt-1 w-full !p-3 !text-sm"
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  Timezone
                </label>
                <select
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  Primary currency
                </label>
                <select
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={settings.primary_currency}
                  onChange={(e) =>
                    setSettings({ ...settings, primary_currency: e.target.value })
                  }
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                Default payment terms
              </label>
              <input
                className="input mt-1 w-full !p-3 !text-sm"
                value={settings.defaultPaymentTerms}
                onChange={(e) =>
                  setSettings({ ...settings, defaultPaymentTerms: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                Fiscal year starts (month)
              </label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={settings.fiscalYearStartMonth}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    fiscalYearStartMonth: Number(e.target.value),
                  })
                }
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Panel>

        <Panel title="Network posture">
          <div className="p-5 space-y-1">
            <Toggle
              label="Discoverable on network"
              desc="Appear in supplier discovery and marketplace search"
              on={settings.is_discoverable}
              onToggle={() => toggle('is_discoverable')}
            />
            <Toggle
              label="Act as buyer"
              desc="Enable SRM procurement features for this company"
              on={settings.is_buyer}
              onToggle={() => toggle('is_buyer')}
            />
          </div>
        </Panel>

        <Panel title="Notifications" className="lg:col-span-2">
          <div className="p-5 grid sm:grid-cols-2 gap-1">
            <Toggle
              label="Email notifications"
              desc="Important account and operational alerts"
              on={settings.emailNotifications}
              onToggle={() => toggle('emailNotifications')}
            />
            <Toggle
              label="Project updates"
              desc="Status changes on company projects"
              on={settings.projectUpdates}
              onToggle={() => toggle('projectUpdates')}
            />
            <Toggle
              label="Team invites"
              desc="Notify when members join or leave"
              on={settings.teamInvites}
              onToggle={() => toggle('teamInvites')}
            />
            <Toggle
              label="PO alerts"
              desc="Purchase order lifecycle and escrow events"
              on={settings.poAlerts}
              onToggle={() => toggle('poAlerts')}
            />
            <Toggle
              label="RIAD alerts"
              desc="Critical risks and open issues"
              on={settings.riadAlerts}
              onToggle={() => toggle('riadAlerts')}
            />
            <Toggle
              label="Weekly digest"
              desc="Summary of CRM / SRM activity"
              on={settings.weeklyDigest}
              onToggle={() => toggle('weeklyDigest')}
            />
            <Toggle
              label="Marketing emails"
              desc="Product updates and tips (optional)"
              on={settings.marketingEmails}
              onToggle={() => toggle('marketingEmails')}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-6 flex justify-end max-w-5xl">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-primary !py-3 !px-8 text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save to Supabase'}
        </button>
      </div>

      {canDelete && (
        <div className="mt-10 max-w-5xl rounded-3xl border border-rose-200 bg-rose-50/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-rose-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="font-bold text-rose-950">Danger zone</h2>
              <p className="text-xs text-rose-900/80">
                Soft-delete this company. Only owners can do this. History is
                retained for audit; the company is removed from your list and
                the public network.
              </p>
            </div>
          </div>
          <div className="p-5">
            {!deleteOpen ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete company…
              </button>
            ) : (
              <div className="space-y-3 max-w-lg">
                <p className="text-sm text-rose-950">
                  To confirm, type the company name{' '}
                  <strong>{tradingName || '…'}</strong> and the word{' '}
                  <strong>DELETE</strong>.
                </p>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-rose-800/70">
                    Company name
                  </label>
                  <input
                    className="input mt-1 w-full !p-3 !text-sm bg-white"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={tradingName}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-rose-800/70">
                    Type DELETE
                  </label>
                  <input
                    className="input mt-1 w-full !p-3 !text-sm bg-white font-mono"
                    value={confirmPhrase}
                    onChange={(e) => setConfirmPhrase(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-rose-800/70">
                    Reason (optional)
                  </label>
                  <input
                    className="input mt-1 w-full !p-3 !text-sm bg-white"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="e.g. Test company, closed business"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void deleteCompany()}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Permanently remove access
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmName('');
                      setConfirmPhrase('');
                      setDeleteReason('');
                    }}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </BusinessPage>
  );
}

function Toggle({
  label,
  desc,
  on,
  onToggle,
}: {
  label: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 rounded-2xl border border-transparent hover:border-neutral-100 hover:bg-neutral-50/80 px-3 py-3 text-left transition-all"
    >
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{desc}</div>
      </div>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? 'bg-[#00b4d8]' : 'bg-neutral-200'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
