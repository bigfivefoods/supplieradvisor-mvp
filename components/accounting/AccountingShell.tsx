'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const ACCOUNTING_NAV: readonly NavItem[] = [
  { href: '/dashboard/accounting', label: 'Command', exact: true },
  { href: '/dashboard/accounting/chart-of-accounts', label: 'CoA' },
  { href: '/dashboard/accounting/journal-entries', label: 'Journals' },
  { href: '/dashboard/accounting/general-ledger', label: 'Ledger' },
  { href: '/dashboard/accounting/accounts-receivable', label: 'AR' },
  { href: '/dashboard/accounting/ecl', label: 'ECL' },
  { href: '/dashboard/accounting/accounts-payable', label: 'AP' },
  { href: '/dashboard/accounting/payments', label: 'Pay' },
  { href: '/dashboard/accounting/debit-orders', label: 'Debit' },
  { href: '/dashboard/accounting/bank-reconciliation', label: 'Bank' },
  { href: '/dashboard/accounting/fixed-assets', label: 'Assets' },
  { href: '/dashboard/accounting/tax', label: 'VAT' },
  { href: '/dashboard/accounting/budget', label: 'Budget' },
  { href: '/dashboard/accounting/management', label: 'Mgmt' },
  { href: '/dashboard/accounting/balance-sheet', label: 'Balance sheet' },
  { href: '/dashboard/accounting/cash-flow', label: 'Cash flow' },
  { href: '/dashboard/accounting/afs', label: 'AFS' },
  { href: '/dashboard/accounting/reports', label: 'Reports' },
  { href: '/dashboard/accounting/entities', label: 'Entities' },
  { href: '/dashboard/accounting/settings', label: 'Settings' },
] as const;


export function AccountingNav() {
  return <RelationshipNav items={ACCOUNTING_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Accounting">{children}</CompanyGate>;
}


export function AccountingHeader({
  title,
  description,
  action,
  titleAccent,
  /**
   * In-page Finance pill strip. Default **false** — module steps already live in the
   * top ModuleProcessBar (Finance). Only set true if a page truly needs a local strip.
   */
  showNav = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  titleAccent?: string;
  showNav?: boolean;
}) {
  void showNav;
  return (
    <RelationshipHeader
      band
      backHref="/dashboard/accounting"
      backLabel="Finance overview"
      eyebrow="Financial control"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function AccountingPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}

/** Print CSS used on cash flow, balance sheet, and other statement pages. */
export function AccountingPrintStyles() {
  return (
    <style>{`
      @media print {
        nav, aside, header, .print\\:hidden { display: none !important; }
        body { background: white !important; }
        section { break-inside: avoid; }
      }
      @page { margin: 16mm; }
    `}</style>
  );
}

/** KPI tile used on cash flow: stats sit above charts, then figures. */
export function AccountingStat({
  label,
  value,
  warn,
  sub,
}: {
  label: string;
  value: string;
  warn?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function AccountingChartsRow({
  children,
  cols = 3,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-4 print:hidden ${
        cols === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'
      }`}
    >
      {children}
    </div>
  );
}
