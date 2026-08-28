'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

/** Secondary pill nav — mirrors process rail (no duplicate settle/AR/reviews paths) */
export const CUSTOMERS_NAV: readonly NavItem[] = [
  { href: '/dashboard/customers', label: 'Overview', exact: true },
  { href: '/dashboard/customers/360', label: '360' },
  { href: '/dashboard/customers/leads', label: 'Source' },
  { href: '/dashboard/customers/profiles', label: 'Profiles' },
  { href: '/dashboard/customers/invites', label: 'Invite' },
  { href: '/dashboard/customers/quotes', label: 'Quote' },
  { href: '/dashboard/customers/orders', label: 'Order' },
  { href: '/dashboard/customers/invoices', label: 'Invoice' },
  { href: '/dashboard/customers/money', label: 'Money' },
  { href: '/dashboard/customers/ratings', label: 'Rate' },
  { href: '/dashboard/customers/report', label: 'Report' },
] as const;


export function CustomersNav() {
  return <RelationshipNav items={CUSTOMERS_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Customers CRM">{children}</CompanyGate>;
}


export function CustomersHeader({
  title,
  description,
  action,
  titleAccent,
  showNav = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  titleAccent?: string;
  /** @deprecated Process steps live in the top module rail. */
  showNav?: boolean;
}) {
  void showNav;
  return (
    <RelationshipHeader
      band
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
