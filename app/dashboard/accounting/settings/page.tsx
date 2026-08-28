'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  statusClass,
  type AccountingPeriod,
  type AccountingSettings,
  type CoaAccount,
} from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { RoleDeniedBanner, RoleAwareButton } from '@/components/chrome/RoleGuard';
import ActivityFeed from '@/components/chrome/ActivityFeed';

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
  const { canFinanceCritical, canAccountingWrite, roleLabel } = useCompanyRole();
  const [settings, setSettings] = useState<AccountingSettings | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [monthLocks, setMonthLocks] = useState<
    { period_key: string; locked: boolean }[]
  >([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [tb, setTb] = useState<{
    balanced: boolean;
    total_debit: number;
    total_credit: number;
    difference: number;
    entry_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partyLedger, setPartyLedger] = useState({
    ar_parent_code: '1180',
    member_ar_parent_code: '',
    ap_parent_code: '2180',
    contractor_ap_parent_code: '',
  });
  const [arParents, setArParents] = useState<CoaAccount[]>([]);
  const [apParents, setApParents] = useState<CoaAccount[]>([]);
  const [ensuringParty, setEnsuringParty] = useState(false);
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
      const lockParams = new URLSearchParams(params);
      lockParams.set('trialBalance', '1');
      const [res, lockRes] = await Promise.all([
        fetch(`/api/accounting/settings?${params}`),
        fetch(`/api/accounting/period-locks?${lockParams}`),
      ]);
      const data = await res.json();
      const lockData = await lockRes.json();
      setSettings(data.settings || null);
      setPeriods(data.periods || []);
      const pl = data.party_ledger || {};
      setPartyLedger({
        ar_parent_code: String(pl.ar_parent_code || pl.parents?.ar?.code || '1180'),
        member_ar_parent_code: String(pl.member_ar_parent_code || ''),
        ap_parent_code: String(pl.ap_parent_code || pl.parents?.ap?.code || '2180'),
        contractor_ap_parent_code: String(pl.contractor_ap_parent_code || ''),
      });
      setArParents(data.ar_parents || []);
      setApParents(data.ap_parents || []);
      setMonthLocks(lockData.locks || []);
      setSuggestions(lockData.suggestions || []);
      setTb(lockData.trial_balance || null);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  async function closeYear() {
    if (
      !window.confirm(
        'Post year-end close? This transfers P&L for the last completed financial year into retained earnings and locks those months. Unlock the last month of that year first if it is locked. Undo only by reversing the close journal.'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'year_end_close',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        `Closed FY ${data.close?.fyLabel || ''} — net ${data.close?.netIncome ?? ''}`
      );
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleMonthLock(period_key: string, locked: boolean) {
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/period-locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, period_key, locked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(locked ? `Locked ${period_key}` : `Unlocked ${period_key}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

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
          default_tax_rate: Number(settings.default_tax_rate || 15),
          invoice_prefix_ar: settings.invoice_prefix_ar,
          invoice_prefix_ap: settings.invoice_prefix_ap,
          journal_prefix: settings.journal_prefix,
          next_ar_number: Number(settings.next_ar_number || 1001),
          next_ap_number: Number(settings.next_ap_number || 1001),
          next_journal_number: Number(settings.next_journal_number || 1),
          lock_date: settings.lock_date || null,
          require_balanced_journals: settings.require_balanced_journals !== false,
          party_ledger: {
            ar_parent_code: partyLedger.ar_parent_code,
            member_ar_parent_code: partyLedger.member_ar_parent_code || null,
            ap_parent_code: partyLedger.ap_parent_code,
            contractor_ap_parent_code: partyLedger.contractor_ap_parent_code || null,
          },
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

  async function ensurePartyNow() {
    setEnsuringParty(true);
    try {
      const res = await fetch('/api/accounting/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, ensure_party: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const created = Number(data.created || 0);
      const linked = Number(data.linked || 0);
      if (created > 0) {
        toast.success(
          `Created ${created} unique customer/supplier account${created === 1 ? '' : 's'}`
        );
      } else if (linked > 0) {
        toast.success('Customer and supplier accounts already on the chart');
      } else {
        toast.message(
          data.warning ||
            'Add customers and suppliers first, then create their accounts here'
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setEnsuringParty(false);
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
        description="Periods, currencies, prefixes, and where new customers and suppliers land on the chart of accounts."
      />

      <SectionLabel>IFRS / SA GAAP close checklist</SectionLabel>
      <Panel className="mb-6">
        <div className="p-5 sm:p-6 space-y-4">
          <ol className="space-y-2 text-sm text-neutral-700 list-decimal list-inside">
            <li>
              Trial balance balanced (debits = credits)
              {tb
                ? tb.balanced
                  ? ' — ready'
                  : ' — fix Δ first'
                : ' — load TB above'}
            </li>
            <li>Bank lines allocated or matched to invoices (do not code invoiced sales to income again)</li>
            <li>Issued AR/AP invoices recognised on the GL; cash applied as settlement, not as a second sale</li>
            <li>VAT input/output reviewed against the period tax list</li>
            <li>Fixed assets capitalised; depreciation posted to month-end</li>
            <li>
              Lock the month (owner / admin / finance only)
              {!canFinanceCritical && ` — your role (${roleLabel || '…'}) cannot lock`}
            </li>
            <li>After year-end, close P&amp;L into retained earnings and lock the financial year</li>
          </ol>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Books follow IFRS-oriented double-entry (accrual). Not automated: expected credit
            losses (IFRS 9), PPE impairment tests (IAS 36), lease accounting (IFRS 16), deferred
            tax (IAS 12), inventory costing layers (IAS 2), or multi-element revenue contracts
            (IFRS 15). Post those as journals on the new CoA accounts (1135, 1240, 6810, 6820).
          </p>
          {canFinanceCritical && (
            <div className="flex flex-wrap gap-2">
              <RoleAwareButton
                allowed={canFinanceCritical}
                deniedHint="Owner, admin, or finance required"
                disabled={saving}
                onClick={() => void closeYear()}
                className="text-xs font-semibold px-3 py-2 rounded-xl border bg-white border-neutral-200 text-neutral-800 hover:border-[#00b4d8]"
              >
                Close last completed financial year
              </RoleAwareButton>
            </div>
          )}
        </div>
      </Panel>

      <SectionLabel>Period locks & trial balance</SectionLabel>
      <Panel className="mb-8">
        <div className="p-5 sm:p-6 space-y-4">
          {tb && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                tb.balanced
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              <strong>Trial balance (all posted journals):</strong>{' '}
              {tb.balanced ? 'Balanced ✓' : `Out of balance by ${tb.difference}`}
              <span className="block text-xs mt-1 opacity-80">
                Debits {Number(tb.total_debit).toLocaleString()} · Credits{' '}
                {Number(tb.total_credit).toLocaleString()} · {tb.entry_count} entries
              </span>
            </div>
          )}
          <p className="text-xs text-neutral-500">
            Locked months reject posted journals. Unlock only for corrections. Run migration{' '}
            <code className="text-[10px]">20260711_accounting_period_locks.sql</code> if this is
            empty.
          </p>
          {!canFinanceCritical && (
            <RoleDeniedBanner message="Only owner, admin, or finance can lock or unlock periods. You can still review status below." />
          )}
          <div className="flex flex-wrap gap-2">
            {(suggestions.length
              ? suggestions
              : Array.from({ length: 6 }, (_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - i);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                })
            ).map((key) => {
              const row = monthLocks.find((l) => l.period_key === key);
              const locked = row?.locked === true;
              return (
                <RoleAwareButton
                  key={key}
                  allowed={canFinanceCritical}
                  deniedHint="Owner, admin, or finance required"
                  disabled={saving}
                  onClick={() => void toggleMonthLock(key, !locked)}
                  className={`text-xs font-semibold px-3 py-2 rounded-xl border ${
                    locked
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:border-[#00b4d8]'
                  }`}
                >
                  {key} · {locked ? 'Locked' : 'Open'}
                </RoleAwareButton>
              );
            })}
          </div>
        </div>
      </Panel>

      <SectionLabel>Audit trail</SectionLabel>
      <div className="mb-8">
        <ActivityFeed limit={30} title="Accounting & company activity" />
      </div>

      <SectionLabel>General</SectionLabel>
      {!canAccountingWrite && (
        <RoleDeniedBanner
          className="mb-4"
          message={`Your role (${roleLabel || 'viewer'}) has view-only access to accounting settings.`}
        />
      )}
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
            <Field label="Financial year starts">
              <p className="field bg-slate-50 font-semibold">
                {new Date(
                  2000,
                  Number(settings?.fiscal_year_start_month || 3) - 1,
                  1
                ).toLocaleString('en', { month: 'long' })}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Set only in{' '}
                <Link
                  href="/dashboard/my-business/settings"
                  className="font-bold text-[#0077b6] underline"
                >
                  Company → Settings
                </Link>
                . Owner or finance lead only.
              </p>
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
              <p className="mt-1 text-[11px] text-neutral-500">
                Posted journals, allocations, and depreciation on or before this date are rejected.
              </p>
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
            <button
              type="submit"
              disabled={saving || !canAccountingWrite}
              className="btn-primary !py-2.5 !px-5 text-sm disabled:opacity-50"
              title={!canAccountingWrite ? 'Write access required' : undefined}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save settings
            </button>
          </div>
        </form>
      </Panel>

      <SectionLabel>Customer & supplier accounts</SectionLabel>
      <Panel className="mb-8">
        <form onSubmit={saveSettings} className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-neutral-600 leading-relaxed">
            Pick the CoA parent for new parties. Each customer and supplier then gets a unique
            sub-account under that parent — for example{' '}
            <code className="text-xs bg-slate-50 px-1 py-0.5 rounded">
              {partyLedger.ar_parent_code || '1180'}-0000001
            </code>{' '}
            through thousands of parties. Used for invoices and bank recon. AR must be an
            asset; AP must be a liability (IAS 1). Employed staff stay on payroll, not AP.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Customers (AR) parent">
              <ParentSelect
                value={partyLedger.ar_parent_code}
                onChange={(code) =>
                  setPartyLedger((s) => ({ ...s, ar_parent_code: code }))
                }
                accounts={arParents}
                fallbackCode="1180"
                fallbackName="Customers"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                New CRM customers nest here and receive a unique AR number.
              </p>
            </Field>
            <Field label="Members, clients & patients (AR)">
              <ParentSelect
                value={partyLedger.member_ar_parent_code}
                onChange={(code) =>
                  setPartyLedger((s) => ({ ...s, member_ar_parent_code: code }))
                }
                accounts={arParents}
                fallbackCode="1180"
                fallbackName="Customers"
                sameAsLabel="Same as customers"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Gym / clinic / retail people. Leave as “same as customers” unless you want them
                on a separate header.
              </p>
            </Field>
            <Field label="Suppliers (AP) parent">
              <ParentSelect
                value={partyLedger.ap_parent_code}
                onChange={(code) =>
                  setPartyLedger((s) => ({ ...s, ap_parent_code: code }))
                }
                accounts={apParents}
                fallbackCode="2180"
                fallbackName="Suppliers"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                New suppliers nest here and receive a unique AP number.
              </p>
            </Field>
            <Field label="Contractors — coaches & clinicians (AP)">
              <ParentSelect
                value={partyLedger.contractor_ap_parent_code}
                onChange={(code) =>
                  setPartyLedger((s) => ({ ...s, contractor_ap_parent_code: code }))
                }
                accounts={apParents}
                fallbackCode="2180"
                fallbackName="Suppliers"
                sameAsLabel="Same as suppliers"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Independent contractors only. Employed coaches/clinicians stay on 6100 salaries
                (IAS 19).
              </p>
            </Field>
          </div>
          <p className="text-[11px] text-neutral-500">
            Need a different header? Create it on the{' '}
            <Link href="/dashboard/accounting/chart-of-accounts" className="font-bold text-[#0077b6] underline">
              chart of accounts
            </Link>
            , then pick it here. Changing the parent applies to new parties; existing unique
            accounts stay put so history is not rewritten.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={ensuringParty || !canAccountingWrite}
              onClick={() => void ensurePartyNow()}
              className="btn-secondary !py-2.5 !px-5 text-sm disabled:opacity-50"
            >
              {ensuringParty ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create missing accounts
            </button>
            <button
              type="submit"
              disabled={saving || !canAccountingWrite}
              className="btn-primary !py-2.5 !px-5 text-sm disabled:opacity-50"
              title={!canAccountingWrite ? 'Write access required' : undefined}
            >
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

function ParentSelect({
  value,
  onChange,
  accounts,
  fallbackCode,
  fallbackName,
  sameAsLabel,
}: {
  value: string;
  onChange: (code: string) => void;
  accounts: CoaAccount[];
  fallbackCode: string;
  fallbackName: string;
  sameAsLabel?: string;
}) {
  const hasFallback = accounts.some((a) => String(a.code) === fallbackCode);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="field"
    >
      {sameAsLabel ? <option value="">{sameAsLabel}</option> : null}
      {!hasFallback ? (
        <option value={fallbackCode}>
          {fallbackCode} · {fallbackName} (default)
        </option>
      ) : null}
      {accounts.map((a) => (
        <option key={a.id} value={String(a.code)}>
          {a.code} · {a.name}
          {a.is_header ? ' (header)' : ''}
        </option>
      ))}
    </select>
  );
}
