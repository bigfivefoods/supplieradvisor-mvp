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
  { href: '/dashboard/accounting/accounts-receivable', label: 'AR' },
  { href: '/dashboard/accounting/accounts-payable', label: 'AP' },
  { href: '/dashboard/accounting/payments', label: 'Pay' },
  { href: '/dashboard/accounting/bank-reconciliation', label: 'Bank' },
  { href: '/dashboard/accounting/management', label: 'Mgmt' },
  { href: '/dashboard/accounting/reports', label: 'Reports' },
  { href: '/dashboard/accounting/tax', label: 'Tax' },
  { href: '/dashboard/accounting/fixed-assets', label: 'Assets' },
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
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  titleAccent?: string;
}) {
  return (
    <RelationshipHeader
      backHref="/dashboard/accounting"
      backLabel="Accounting overview"
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
