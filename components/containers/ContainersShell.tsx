'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const CONTAINERS_NAV: readonly NavItem[] = [
  { href: '/dashboard/containers', label: 'Command', exact: true },
  { href: '/dashboard/containers/manage', label: 'Manage' },
  { href: '/dashboard/containers/map', label: 'Map' },
  { href: '/dashboard/containers/impact', label: 'Impact' },
  { href: '/dashboard/containers/feasibility', label: 'Feasibility' },
  { href: '/dashboard/containers/add', label: 'Add' },
  { href: '/dashboard/containers/contractors', label: 'Contractors' },
  { href: '/dashboard/containers/training', label: 'Train' },
  { href: '/dashboard/containers/metrics', label: 'Metrics' },
  { href: '/dashboard/containers/settings', label: 'Share' },
  { href: '/dashboard/containers/riad-log', label: 'RIAD' },
  { href: '/dashboard/containers/reports', label: 'Reports' },
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
  /** Process links live in the sticky ModuleProcessBar only — keep false to avoid duplicate nav. */
  showNav = false,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  titleAccent?: string;
  showNav?: boolean;
}) {
  return (
    <RelationshipHeader
      nav={showNav ? <ContainersNav /> : undefined}
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
