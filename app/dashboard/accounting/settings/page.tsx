'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  statusClass,
  type AccountingPeriod,
  type AccountingSettings,
} from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';

export default function AccountingSettingsPage() {
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
  const [settings, setSettings] = useState<AccountingSettings | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPeriod, setShowPeriod] = useState(false);
  const [periodForm, setPeriodForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    fiscal_year: String(new Date().getFullYear()),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/settings?${params}`);
      const data = await res.json();
      setSettings(data.settings || null);
      setPeriods(data.periods || []);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          base_currency: settings.base_currency,
          fiscal_year_start_month: Number(settings.fiscal_year_start_month || 3),
          default_tax_rate: Number(settings.default_tax_rate || 15),
          invoice_prefix_ar: settings.invoice_prefix_ar,
          invoice_prefix_ap: settings.invoice_prefix_ap,
          journal_prefix: settings.journal_prefix,
          next_ar_number: Number(settings.next_ar_number || 1001),
          next_ap_number: Number(settings.next_ap_number || 1001),
          next_journal_number: Number(settings.next_journal_number || 1),
          lock_date: settings.lock_date || null,
          require_balanced_journals: settings.require_balanced_journals !== false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSettings(data.settings);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function createPeriod(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          ...periodForm,
          fiscal_year: Number(periodForm.fiscal_year),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Period created');
      setShowPeriod(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AccountingPage>
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </AccountingPage>
    );
  }

  return (
    <AccountingPage>
      <AccountingHeader
        title="Accounting"
        titleAccent="settings"
        description="Periods, currencies, document number prefixes, and system defaults."
      />

      <SectionLabel>General</SectionLabel>
      <Panel className="mb-8">
        <form onSubmit={saveSettings} className="p-5 sm:p-6 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Base currency">
              <input
                value={settings?.base_currency || 'ZAR'}
                onChange={(e) =>
                  setSettings((s) => ({ ...(s || {}), base_currency: e.target.value }))
                }
                className="field"
              />
            </Field>
            <Field label="Fiscal year start month (1–12)">
              <input
                type="number"
                min={1}
                max={12}
                value={settings?.fiscal_year_start_month ?? 3}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...(s || {}),
                    fiscal_year_start_month: Number(e.target.value),
                  }))
                }
                className="field"
              />
            </Field>
            <Field label="Default tax rate %">
              <input
                type="number"
                min={0}
                step={0.01}
                value={settings?.default_tax_rate ?? 15}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...(s || {}),
                    default_tax_rate: Number(e.target.value),
                  }))
                }
                className="field"
              />
            </Field>
            <Field label="AR invoice prefix">
              <input
                value={settings?.invoice_prefix_ar || 'INV'}
                onChange={(e) =>
                  setSettings((s) => ({ ...(s || {}), invoice_prefix_ar: e.target.value }))
                }
                className="field"
              />
            </Field>
            <Field label="AP bill prefix">
              <input
                value={settings?.invoice_prefix_ap || 'BILL'}
                onChange={(e) =>
                  setSettings((s) => ({ ...(s || {}), invoice_prefix_ap: e.target.value }))
                }
                className="field"
              />
            </Field>
            <Field label="Journal prefix">
              <input
                value={settings?.journal_prefix || 'JE'}
                onChange={(e) =>
                  setSettings((s) => ({ ...(s || {}), journal_prefix: e.target.value }))
                }
                className="field"
              />
            </Field>
            <Field label="Next AR number">
              <input
                type="number"
                value={settings?.next_ar_number ?? 1001}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...(s || {}),
                    next_ar_number: Number(e.target.value),
                  }))
                }
                className="field"
              />
            </Field>
            <Field label="Next AP number">
              <input
                type="number"
                value={settings?.next_ap_number ?? 1001}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...(s || {}),
                    next_ap_number: Number(e.target.value),
                  }))
                }
                className="field"
              />
            </Field>
            <Field label="Next journal number">
              <input
                type="number"
                value={settings?.next_journal_number ?? 1}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...(s || {}),
                    next_journal_number: Number(e.target.value),
                  }))
                }
                className="field"
              />
            </Field>
            <Field label="Lock date">
              <input
                type="date"
                value={settings?.lock_date || ''}
                onChange={(e) =>
                  setSettings((s) => ({ ...(s || {}), lock_date: e.target.value || null }))
                }
                className="field"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
            <input
              type="checkbox"
              checked={settings?.require_balanced_journals !== false}
              onChange={(e) =>
                setSettings((s) => ({
                  ...(s || {}),
                  require_balanced_journals: e.target.checked,
                }))
              }
            />
            Require balanced journals on post
          </label>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary !py-2.5 !px-5 text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save settings
            </button>
          </div>
        </form>
      </Panel>

      <SectionLabel
        action={
          <button
            type="button"
            onClick={() => setShowPeriod(true)}
            className="text-xs font-semibold text-[#00b4d8] hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add period
          </button>
        }
      >
        Accounting periods
      </SectionLabel>
      <Panel>
        {periods.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-neutral-500">
            No periods defined. Create monthly or annual periods for reporting close.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {periods.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <div className="text-xs text-neutral-500">
                    {p.start_date} → {p.end_date}
                    {p.fiscal_year ? ` · FY${p.fiscal_year}` : ''}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(p.status)}`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {showPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold">New period</h3>
              <button type="button" onClick={() => setShowPeriod(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={createPeriod} className="p-5 space-y-3">
              <label className="block text-xs font-semibold text-neutral-600">
                Name
                <input
                  required
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="FY2026 Q1"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Start
                  <input
                    required
                    type="date"
                    value={periodForm.start_date}
                    onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  End
                  <input
                    required
                    type="date"
                    value={periodForm.end_date}
                    onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowPeriod(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e5e5e5;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          background: white;
          margin-top: 0.25rem;
        }
        .field:focus {
          outline: none;
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.12);
        }
      `}</style>
    </AccountingPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-neutral-600">
      {label}
      {children}
    </label>
  );
}
