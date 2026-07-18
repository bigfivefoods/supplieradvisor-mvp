'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

/**
 * Lean network nav — one place per job.
 * Discover / invite live here; SRM book & CRM accounts stay under Suppliers / Customers.
 */
export const CONNECTIONS_NAV: readonly NavItem[] = [
  { href: '/dashboard/connections', label: 'Graph', exact: true },
  { href: '/dashboard/connections/discover', label: 'Open to trade' },
  { href: '/dashboard/suppliers/discover', label: 'Discover' },
  { href: '/dashboard/connections/pricing', label: 'Pricing' },
  { href: '/dashboard/connections/marketplace', label: 'Marketplace' },
  { href: '/dashboard/connections/marketplace/sell', label: 'Sell' },
  { href: '/dashboard/settle', label: 'Settle' },
  { href: '/dashboard/invite-business', label: 'Invite' },
] as const;


export function ConnectionsNav() {
  return <RelationshipNav items={CONNECTIONS_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Network connections">{children}</CompanyGate>;
}


export function ConnectionsHeader({
  title,
  description,
  action,
  titleAccent,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  titleAccent?: string;
}) {
  return (
    <RelationshipHeader
      backHref="/dashboard"
      backLabel="Dashboard"
      eyebrow="Company network"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function ConnectionsPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
