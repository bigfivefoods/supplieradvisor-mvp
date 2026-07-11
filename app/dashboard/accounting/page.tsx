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
  RefreshCw,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney, type AccountingSummary } from '@/lib/accounting/types';
import {
  CompanyRequired,
  AccountingPage,
} from '@/components/accounting/AccountingShell';
import {
  AlertBanner,
  RelationshipHeader,
} from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

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
  const [vatNet, setVatNet] = useState<number | null>(null);
  const [vatOutput, setVatOutput] = useState<number | null>(null);
  const [vatInput, setVatInput] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const [res, taxRes] = await Promise.all([
        fetch(`/api/accounting/summary?${params}`),
        fetch(`/api/accounting/tax?${params}&includeUnclassified=0`).catch(() => null),
      ]);
      const data = await res.json();
      setSummary(data.summary || null);
      setWarning(
        Array.isArray(data.warnings) && data.warnings.length
          ? data.warnings[0]
          : data.warning || null
      );
      setHint(data.hint || null);

      if (taxRes?.ok) {
        const t = await taxRes.json();
        const box = t.returnBox || t.summary || null;
        if (box) {
          setVatNet(
            box.netVat != null
              ? Number(box.netVat)
              : Number(box.outputVat || 0) - Number(box.inputVat || 0)
          );
          setVatOutput(box.outputVat != null ? Number(box.outputVat) : null);
          setVatInput(box.inputVat != null ? Number(box.inputVat) : null);
        } else {
          setVatNet(null);
          setVatOutput(null);
          setVatInput(null);
        }
      }
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
  const s = summary;

  const modules: HubModule[] = [
    {
      href: '/dashboard/accounting/chart-of-accounts',
      icon: BookOpen,
      code: '01',
      title: 'Chart of Accounts',
      desc: 'Flexible multi-type CoA with balances — seed a full IFRS starter set.',
      accent: 'from-violet-50 to-white border-violet-100',
      metric: s?.coaActive ?? '—',
      metricLabel: 'active',
    },
    {
      href: '/dashboard/accounting/journal-entries',
      icon: FileText,
      code: '02',
      title: 'Journal entries',
      desc: 'Double-entry journals — draft, post, void with balance checks.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: s?.journalsPosted ?? '—',
      metricLabel: 'posted',
    },
    {
      href: '/dashboard/accounting/accounts-receivable',
      icon: ArrowDownCircle,
      code: '03',
      title: 'Accounts receivable',
      desc: 'Customer invoices, collections, overdue tracking.',
      accent: 'from-cyan-50 to-white border-cyan-100',
      metric: s?.arOpen ?? '—',
      metricLabel: 'open',
    },
    {
      href: '/dashboard/accounting/accounts-payable',
      icon: ArrowUpCircle,
      code: '04',
      title: 'Accounts payable',
      desc: 'Supplier bills, credit notes, payment runs.',
      accent: 'from-emerald-50 to-white border-emerald-100',
      metric: s?.apOpen ?? '—',
      metricLabel: 'open',
    },
    {
      href: '/dashboard/accounting/payments',
      icon: CreditCard,
      code: '05',
      title: 'Payments',
      desc: 'Inbound receipts and outbound supplier payments.',
      accent: 'from-amber-50 to-white border-amber-100',
    },
    {
      href: '/dashboard/accounting/bank-reconciliation',
      icon: Landmark,
      code: '06',
      title: 'Bank import & allocation',
      desc: 'CSV from FNB/RMB → allocate income/expense → journals.',
      accent: 'from-rose-50 to-white border-rose-100',
    },
    {
      href: '/dashboard/accounting/management',
      icon: BarChart3,
      code: '07',
      title: 'Management accounts',
      desc: 'Period P&L from allocated books — revenue, costs, profit.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/accounting/reports',
      icon: BarChart3,
      code: '08',
      title: 'Reports & analytics',
      desc: 'Trial balance, P&L, balance sheet, aging, cash flow.',
      accent: 'from-sky-50 to-white border-sky-100',
    },
    {
      href: '/dashboard/accounting/tax',
      icon: Receipt,
      code: '09',
      title: 'VAT & tax',
      desc: 'VAT return box, output/input, rates, and SARS-ready summary.',
      accent: 'from-slate-50 to-white border-slate-200',
      metric:
        vatNet != null
          ? formatMoney(vatNet, cur)
          : 'Open',
      metricLabel: vatNet != null ? 'net VAT' : 'rates',
    },
    {
      href: '/dashboard/accounting/fixed-assets',
      icon: Building2,
      code: '10',
      title: 'Fixed assets',
      desc: 'Asset register, straight-line depreciation, disposals.',
      accent: 'from-emerald-50 to-white border-emerald-100',
    },
    {
      href: '/dashboard/accounting/entities',
      icon: Globe,
      code: '11',
      title: 'Legal entities',
      desc: 'Companies, branches, multi-currency entities.',
      accent: 'from-amber-50 to-white border-amber-100',
    },
    {
      href: '/dashboard/accounting/settings',
      icon: Settings,
      code: '12',
      title: 'Settings',
      desc: 'Periods, currencies, document prefixes, lock date.',
      accent: 'from-cyan-50 to-white border-cyan-100',
    },
  ];

  return (
    <AccountingPage>
      <RelationshipHeader
        eyebrow="Financial control"
        title="Accounting"
        titleAccent="Command"
        description="Full double-entry books: chart of accounts, journals, AR/AP, payments, bank reconciliation, tax, fixed assets, and live financial statements."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/dashboard/accounting/journal-entries"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> New journal
            </Link>
          </div>
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

      <HubHero
        pill="Live ledger · CoA → reports"
        title="One ledger of truth."
        description="Double-entry always. AR and AP close the loop from sales and purchasing. Bank, tax, assets, and reports read the same books."
        stats={[
          {
            label: 'AR open',
            value: loading ? '—' : formatMoney(s?.arOpenAmount ?? 0, cur),
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'AP open',
            value: loading ? '—' : formatMoney(s?.apOpenAmount ?? 0, cur),
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Net VAT',
            value:
              loading || vatNet == null ? (loading ? '—' : 'Open') : formatMoney(vatNet, cur),
            valueClass: 'text-violet-600',
          },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="GL accounts"
          value={s?.coaActive ?? 0}
          sub={`${s?.coaCount ?? 0} total`}
          accent="violet"
          icon={BookOpen}
          href="/dashboard/accounting/chart-of-accounts"
        />
        <TelemetryCard
          label="Journals posted"
          value={s?.journalsPosted ?? 0}
          sub={`${s?.journalsDraft ?? 0} draft`}
          accent="sky"
          icon={FileText}
          href="/dashboard/accounting/journal-entries"
        />
        <TelemetryCard
          label="AR open"
          value={loading ? '—' : formatMoney(s?.arOpenAmount ?? 0, cur)}
          sub={`${s?.arOpen ?? 0} invoices`}
          accent="cyan"
          icon={ArrowDownCircle}
          href="/dashboard/accounting/accounts-receivable"
        />
        <TelemetryCard
          label="AP open"
          value={loading ? '—' : formatMoney(s?.apOpenAmount ?? 0, cur)}
          sub={`${s?.apOpen ?? 0} bills`}
          accent="emerald"
          icon={ArrowUpCircle}
          href="/dashboard/accounting/accounts-payable"
        />
        <TelemetryCard
          label="Bank balance"
          value={loading ? '—' : formatMoney(s?.bankBalance ?? 0, cur)}
          sub={`${s?.bankAccounts ?? 0} accts · ${s?.unreconciled ?? 0} unreconciled`}
          accent="amber"
          icon={Landmark}
          href="/dashboard/accounting/bank-reconciliation"
        />
        <TelemetryCard
          label="Payments MTD"
          value={s?.paymentsThisMonth ?? 0}
          sub={formatMoney(s?.paymentsThisMonthAmount ?? 0, cur)}
          accent="slate"
          icon={CreditCard}
          href="/dashboard/accounting/payments"
        />
        <TelemetryCard
          label="VAT (net)"
          value={
            loading
              ? '—'
              : vatNet != null
                ? formatMoney(vatNet, cur)
                : 'Setup'
          }
          sub={
            vatOutput != null || vatInput != null
              ? `Out ${formatMoney(vatOutput ?? 0, cur)} · In ${formatMoney(vatInput ?? 0, cur)}`
              : 'Return box · rates · codes'
          }
          accent="violet"
          icon={Receipt}
          href="/dashboard/accounting/tax"
        />
        <TelemetryCard
          label="AR overdue"
          value={loading ? '—' : formatMoney(s?.arOverdueAmount ?? 0, cur)}
          sub={`${s?.arOverdue ?? 0} invoices`}
          accent={(s?.arOverdue || 0) > 0 ? 'rose' : 'slate'}
          icon={ArrowDownCircle}
          href="/dashboard/accounting/accounts-receivable"
        />
        <TelemetryCard
          label="Fixed assets BV"
          value={loading ? '—' : formatMoney(s?.assetsBookValue ?? 0, cur)}
          sub={`${s?.assets ?? 0} active assets`}
          accent="emerald"
          icon={Building2}
          href="/dashboard/accounting/fixed-assets"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={modules} />

      <HubPrinciples
        items={[
          {
            title: 'Double-entry always',
            body: 'Every journal balances debits and credits. Posting is blocked when the entry does not balance.',
          },
          {
            title: 'AR and AP close the loop',
            body: 'Invoices flow from sales and purchasing into collections and payment runs with live balances.',
          },
          {
            title: 'One ledger of truth',
            body: 'Bank, tax, assets, and reports read the same books — membership-checked against your company.',
          },
        ]}
      />
    </AccountingPage>
  );
}
