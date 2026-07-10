'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const CONTAINERS_NAV: readonly NavItem[] = [
  { href: '/dashboard/containers', label: 'Overview', exact: true },
  { href: '/dashboard/containers/manage', label: 'Manage' },
  { href: '/dashboard/containers/map', label: 'Map' },
  { href: '/dashboard/containers/add', label: 'Add' },
  { href: '/dashboard/containers/contractors', label: 'Contractors' },
  { href: '/dashboard/containers/training', label: 'Training' },
  { href: '/dashboard/containers/riad-log', label: 'RIAD' },
  { href: '/dashboard/containers/metrics', label: 'Metrics' },
] as const;


export function ContainersNav() {
  return <RelationshipNav items={CONTAINERS_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Containers">{children}</CompanyGate>;
}


export function ContainersHeader({
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
      backHref="/dashboard/containers"
      backLabel="Containers overview"
      eyebrow="Container retail network"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function ContainersPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
