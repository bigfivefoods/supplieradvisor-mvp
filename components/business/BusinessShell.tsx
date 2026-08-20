'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const BUSINESS_NAV: readonly NavItem[] = [
  { href: '/dashboard/my-business', label: 'Overview', exact: true },
  { href: '/dashboard/my-business/profile', label: 'Profile' },
  { href: '/dashboard/my-business/modules', label: 'Modules' },
  { href: '/dashboard/my-business/team', label: 'Team' },
  { href: '/dashboard/my-business/trust', label: 'Trust' },
  { href: '/dashboard/my-business/billing', label: 'Billing' },
  { href: '/dashboard/my-business/settings', label: 'Settings' },
] as const;


export function BusinessNav() {
  return <RelationshipNav items={BUSINESS_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Company">{children}</CompanyGate>;
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
      band
      backHref="/dashboard/my-business"
      backLabel="Company overview"
      eyebrow="Company"
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
