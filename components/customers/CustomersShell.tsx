'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const CUSTOMERS_NAV: readonly NavItem[] = [
  { href: '/dashboard/customers', label: 'Overview', exact: true },
  { href: '/dashboard/customers/leads', label: 'Pipeline' },
  { href: '/dashboard/customers/profiles', label: 'Profiles' },
  { href: '/dashboard/customers/onboard', label: 'Add' },
  { href: '/dashboard/customers/invites', label: 'Invites' },
  { href: '/dashboard/connections', label: 'Network' },
  { href: '/dashboard/customers/quotes', label: 'Quotes' },
  { href: '/dashboard/customers/orders', label: 'Orders' },
  { href: '/dashboard/customers/invoices', label: 'Invoices' },
  { href: '/dashboard/customers/reviews', label: 'Reviews' },
  { href: '/dashboard/customers/loyalty', label: 'Loyalty' },
  { href: '/dashboard/customers/claims', label: 'Claims' },
  { href: '/dashboard/customers/contracts', label: 'Contracts' },
  { href: '/dashboard/customers/portal', label: 'Ops' },
  { href: '/dashboard/customers/riad-log', label: 'RIAD' },
] as const;

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Customers CRM">{children}</CompanyGate>;
}

export function CustomersNav() {
  return <RelationshipNav items={CUSTOMERS_NAV} />;
}

export function CustomersHeader({
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
      nav={<CustomersNav />}
      backHref="/dashboard/customers"
      backLabel="Customers overview"
      eyebrow="Customer relationship management"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function CustomersPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
