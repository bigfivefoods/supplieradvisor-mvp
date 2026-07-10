'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  CreditCard,
  BarChart3,
  Receipt,
  Building2,
  Settings,
  Globe,
  Plus,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney, type AccountingSummary } from '@/lib/accounting/types';
import {
  CompanyRequired,
  AccountingNav,
  AccountingPage,
} from '@/components/accounting/AccountingShell';
import {
  AlertBanner,
  KpiCard,
  ModuleGrid,
  Panel,
  ProcessRail,
  RelationshipHeader,
  SectionLabel,
  type ModuleCard,
} from '@/components/relationship/RelationshipChrome';

const PROCESS = [
  { label: 'CoA', href: '/dashboard/accounting/chart-of-accounts' },
  { label: 'Journal', href: '/dashboard/accounting/journal-entries' },
  { label: 'AR', href: '/dashboard/accounting/accounts-receivable' },
  { label: 'AP', href: '/dashboard/accounting/accounts-payable' },
  { label: 'Pay', href: '/dashboard/accounting/payments' },
  { label: 'Bank', href: '/dashboard/accounting/bank-reconciliation' },
  { label: 'Report', href: '/dashboard/accounting/reports' },
];

const MODULES: ModuleCard[] = [
  {
    href: '/dashboard/accounting/chart-of-accounts',
    icon: BookOpen,
    title: 'Chart of Accounts',
    desc: 'Flexible multi-type CoA with balances — seed a full IFRS starter set',
    badge: 'Core',
  },
  {
    href: '/dashboard/accounting/journal-entries',
    icon: FileText,
    title: 'Journal entries',
    desc: 'Double-entry journals — draft, post, void with balance checks',
    badge: 'Core',
  },
  {
    href: '/dashboard/accounting/accounts-receivable',
    icon: ArrowDownCircle,
    title: 'Accounts receivable',
    desc: 'Customer invoices, collections, overdue tracking',
    badge: 'AR',
  },
  {
    href: '/dashboard/accounting/accounts-payable',
    icon: ArrowUpCircle,
    title: 'Accounts payable',
    desc: 'Supplier bills, credit notes, payment runs',
    badge: 'AP',
  },
  {
    href: '/dashboard/accounting/payments',
    icon: CreditCard,
    title: 'Payments',
    desc: 'Inbound receipts and outbound supplier payments',
  },
  {
    href: '/dashboard/accounting/bank-reconciliation',
    icon: Landmark,
    title: 'Bank & reconciliation',
    desc: 'Bank accounts, statement lines, match and clear',
  },
  {
    href: '/dashboard/accounting/reports',
    icon: BarChart3,
    title: 'Reports & analytics',
    desc: 'Trial balance, P&L, balance sheet, aging, cash flow',
    badge: 'Live',
  },
  {
    href: '/dashboard/accounting/tax',
    icon: Receipt,
    title: 'Tax & compliance',
    desc: 'VAT rates, output/input summary, multi-code setup',
  },
  {
    href: '/dashboard/accounting/fixed-assets',
    icon: Building2,
    title: 'Fixed assets',
    desc: 'Asset register, straight-line depreciation, disposals',
  },
  {
    href: '/dashboard/accounting/entities',
    icon: Globe,
    title: 'Legal entities',
    desc: 'Companies, branches, multi-currency entities',
  },
  {
    href: '/dashboard/accounting/settings',
    icon: Settings,
    title: 'Settings',
    desc: 'Periods, currencies, document prefixes, lock date',
  },
];

export default function AccountingHub() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/summary?${params}`);
      const data = await res.json();
      setSummary(data.summary || null);
      setWarning(
        Array.isArray(data.warnings) && data.warnings.length
          ? data.warnings[0]
          : data.warning || null
      );
      setHint(data.hint || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cur = summary?.currency || 'ZAR';

  return (
    <AccountingPage>
      <RelationshipHeader
        nav={<AccountingNav />}
        eyebrow="Financial control"
        title="Accounting,"
        titleAccent="balanced"
        description="Full double-entry books: chart of accounts, journals, AR/AP, payments, bank reconciliation, tax, fixed assets, and live financial statements — one precision ledger for your company."
        action={
          <>
            <Link
              href="/dashboard/accounting/journal-entries"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> New journal
            </Link>
            <Link
              href="/dashboard/accounting/accounts-receivable"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <ArrowDownCircle className="w-4 h-4" /> AR
            </Link>
          </>
        }
      />

      {warning && (
        <AlertBanner>
          {warning}
          {hint && (
            <span className="block text-xs mt-1 opacity-80">
              {hint.includes('20260710') ? (
                <>
                  Run <code className="font-mono">20260710_accounting_module.sql</code> in Supabase.
                </>
              ) : (
                hint
              )}
            </span>
          )}
        </AlertBanner>
      )}

      <SectionLabel>Ledger lifecycle</SectionLabel>
      <ProcessRail steps={PROCESS} />

      <SectionLabel>Pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={BookOpen}
          label="GL accounts"
          value={summary?.coaActive ?? 0}
          sub={`${summary?.coaCount ?? 0} total`}
          href="/dashboard/accounting/chart-of-accounts"
          loading={loading}
        />
        <KpiCard
          icon={FileText}
          label="Journals posted"
          value={summary?.journalsPosted ?? 0}
          sub={`${summary?.journalsDraft ?? 0} draft`}
          href="/dashboard/accounting/journal-entries"
          tone="cyan"
          loading={loading}
        />
        <KpiCard
          icon={ArrowDownCircle}
          label="AR open"
          value={loading ? '—' : formatMoney(summary?.arOpenAmount ?? 0, cur)}
          sub={`${summary?.arOpen ?? 0} invoices`}
          href="/dashboard/accounting/accounts-receivable"
          loading={loading}
        />
        <KpiCard
          icon={ArrowUpCircle}
          label="AP open"
          value={loading ? '—' : formatMoney(summary?.apOpenAmount ?? 0, cur)}
          sub={`${summary?.apOpen ?? 0} bills`}
          href="/dashboard/accounting/accounts-payable"
          loading={loading}
        />
        <KpiCard
          icon={Landmark}
          label="Bank balance"
          value={loading ? '—' : formatMoney(summary?.bankBalance ?? 0, cur)}
          sub={`${summary?.bankAccounts ?? 0} accounts · ${summary?.unreconciled ?? 0} unreconciled`}
          href="/dashboard/accounting/bank-reconciliation"
          tone="emerald"
          loading={loading}
        />
        <KpiCard
          icon={CreditCard}
          label="Payments MTD"
          value={summary?.paymentsThisMonth ?? 0}
          sub={formatMoney(summary?.paymentsThisMonthAmount ?? 0, cur)}
          href="/dashboard/accounting/payments"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-10">
        <KpiCard
          icon={ArrowDownCircle}
          label="AR overdue"
          value={loading ? '—' : formatMoney(summary?.arOverdueAmount ?? 0, cur)}
          sub={`${summary?.arOverdue ?? 0} invoices`}
          href="/dashboard/accounting/accounts-receivable"
          tone={(summary?.arOverdue || 0) > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
        <KpiCard
          icon={ArrowUpCircle}
          label="AP overdue"
          value={loading ? '—' : formatMoney(summary?.apOverdueAmount ?? 0, cur)}
          sub={`${summary?.apOverdue ?? 0} bills`}
          href="/dashboard/accounting/accounts-payable"
          tone={(summary?.apOverdue || 0) > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
        <KpiCard
          icon={Building2}
          label="Fixed assets BV"
          value={loading ? '—' : formatMoney(summary?.assetsBookValue ?? 0, cur)}
          sub={`${summary?.assets ?? 0} active assets`}
          href="/dashboard/accounting/fixed-assets"
          tone="violet"
          loading={loading}
        />
      </div>

      <SectionLabel
        action={
          <Link
            href="/dashboard/accounting/reports"
            className="text-xs font-semibold text-[#00b4d8] hover:underline"
          >
            Open reports →
          </Link>
        }
      >
        Workspace
      </SectionLabel>
      <ModuleGrid modules={MODULES} />

      <div className="mt-10">
        <Panel title="Operating principle">
          <div className="px-5 py-6 sm:px-8 sm:py-8 grid sm:grid-cols-3 gap-6 text-sm">
            <Principle
              n="01"
              title="Double-entry always"
              body="Every journal balances debits and credits. Posting is blocked when the entry does not balance."
            />
            <Principle
              n="02"
              title="AR and AP close the loop"
              body="Invoices flow from sales and purchasing into collections and payment runs with live balances."
            />
            <Principle
              n="03"
              title="One ledger of truth"
              body="Bank, tax, assets, and reports read the same books — membership-checked against your company."
            />
          </div>
        </Panel>
      </div>
    </AccountingPage>
  );
}

function Principle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-[0.2em] text-[#00b4d8] mb-2">{n}</div>
      <div className="font-bold text-slate-900 mb-1.5">{title}</div>
      <p className="text-xs text-neutral-500 leading-relaxed">{body}</p>
    </div>
  );
}
