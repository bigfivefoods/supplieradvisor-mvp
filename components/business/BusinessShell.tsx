'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const BUSINESS_NAV: readonly NavItem[] = [
  { href: '/dashboard/my-business', label: 'Command', exact: true },
  { href: '/dashboard/my-business/profile', label: 'Profile' },
  { href: '/dashboard/my-business/group', label: 'Group' },
  { href: '/dashboard/my-business/verifications', label: 'Verify ops' },
  { href: '/dashboard/my-business/billing', label: 'Billing' },
  { href: '/dashboard/my-business/ops', label: 'Ops' },
  { href: '/dashboard/my-business/team', label: 'Team' },
  { href: '/dashboard/my-business/settings', label: 'Settings' },
  { href: '/dashboard/my-business/legal', label: 'Legal' },
  { href: '/dashboard/my-business/documents', label: 'Documents' },
  { href: '/dashboard/my-business/projects', label: 'Projects' },
  { href: '/dashboard/my-business/riad-log', label: 'RIAD' },
] as const;


export function BusinessNav() {
  return <RelationshipNav items={BUSINESS_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="My Business">{children}</CompanyGate>;
}


export function BusinessHeader({
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
      backHref="/dashboard/my-business"
      backLabel="My Business overview"
      eyebrow="Company workspace"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function BusinessPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
