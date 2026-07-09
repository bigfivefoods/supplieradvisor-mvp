'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const CONNECTIONS_NAV: readonly NavItem[] = [
  { href: '/dashboard/connections', label: 'Network', exact: true },
  { href: '/dashboard/suppliers/discover', label: 'Find suppliers' },
  { href: '/dashboard/customers/onboard', label: 'Add customer' },
  { href: '/dashboard/invite-business', label: 'Invite company' },
  { href: '/dashboard/suppliers/network', label: 'SRM book' },
  { href: '/dashboard/customers/profiles', label: 'CRM accounts' },
] as const;

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Network connections">{children}</CompanyGate>;
}

export function ConnectionsNav() {
  return <RelationshipNav items={CONNECTIONS_NAV} />;
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
      nav={<ConnectionsNav />}
      backHref="/dashboard"
      backLabel="Dashboard"
      eyebrow="Integrated supply chain network"
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
