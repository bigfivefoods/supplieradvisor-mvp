'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

/**
 * In-page SchoolAdvisor® nav is OFF by default — module chrome (sidebar + process bar)
 * is the single source of truth, grouped DBE → School → SP (public sector only).
 * Kept for rare explicit showNav=true use.
 */
export const SCHOOLS_NAV: readonly NavItem[] = [
  { href: '/dashboard/schools/agency', label: 'DBE · Approve' },
  { href: '/dashboard/schools/approved-list', label: 'DBE · Catalogue' },
  { href: '/dashboard/schools/agency-report', label: 'DBE · Programme' },
  { href: '/dashboard/schools', label: 'School · Command', exact: true },
  { href: '/dashboard/schools/serve-day', label: 'School · Serve' },
  { href: '/dashboard/schools/kitchen', label: 'School · Kitchen' },
  { href: '/dashboard/schools/isps', label: 'SP · Network' },
  { href: '/dashboard/schools/isp-sla', label: 'SP · SLA' },
] as const;

export function SchoolsNav() {
  return <RelationshipNav items={SCHOOLS_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="SchoolAdvisor®">{children}</CompanyGate>;
}

export function SchoolsHeader({
  title,
  description,
  action,
  titleAccent,
  /** Never on by default — avoids duplicating module navbar */
  showNav = false,
  mode = 'school',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  titleAccent?: string;
  showNav?: boolean;
  mode?: 'school' | 'agency' | 'isp';
}) {
  void showNav;
  const eyebrow =
    mode === 'agency'
      ? 'SchoolAdvisor® · DBE / PEU (public sector)'
      : mode === 'isp'
        ? 'SchoolAdvisor® · SP supply'
        : 'SchoolAdvisor® · NSNP kitchen';

  return (
    <RelationshipHeader
      band
      backHref="/dashboard/schools"
      backLabel="SchoolAdvisor command"
      eyebrow={eyebrow}
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function SchoolsPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
