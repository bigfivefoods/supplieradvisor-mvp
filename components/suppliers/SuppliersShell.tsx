'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const SUPPLIERS_NAV: readonly NavItem[] = [
  { href: '/dashboard/suppliers', label: 'Overview', exact: true },
  { href: '/dashboard/suppliers/discover', label: 'Discover' },
  { href: '/dashboard/suppliers/network', label: 'Book' },
  { href: '/dashboard/connections', label: 'Connections' },
  { href: '/dashboard/suppliers/add', label: 'Add' },
  { href: '/dashboard/suppliers/invites', label: 'Invites' },
  { href: '/dashboard/suppliers/performance', label: 'OTIFEF' },
  { href: '/dashboard/suppliers/ratings', label: 'Ratings' },
  { href: '/dashboard/suppliers/documents', label: 'Documents' },
  { href: '/dashboard/suppliers/po', label: 'POs' },
  { href: '/dashboard/suppliers/portal', label: 'Ops' },
  { href: '/dashboard/suppliers/contracts', label: 'Contracts' },
  { href: '/dashboard/suppliers/riad-log', label: 'RIAD' },
] as const;


export function SuppliersNav() {
  return <RelationshipNav items={SUPPLIERS_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Suppliers SRM">{children}</CompanyGate>;
}


export function SuppliersHeader({
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
      backHref="/dashboard/suppliers"
      backLabel="Suppliers overview"
      eyebrow="Supplier relationship management"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function SuppliersPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
