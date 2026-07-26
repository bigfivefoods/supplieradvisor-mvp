'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const SCHOOLS_NAV: readonly NavItem[] = [
  { href: '/dashboard/schools', label: 'Command', exact: true },
  { href: '/dashboard/schools/serve-day', label: 'Serve day' },
  { href: '/dashboard/schools/profile', label: 'School' },
  { href: '/dashboard/schools/surveys', label: 'Surveys' },
  { href: '/dashboard/schools/riad', label: 'RIAD' },
  { href: '/dashboard/schools/maintenance', label: 'Maintain' },
  { href: '/dashboard/schools/learners', label: 'Learners' },
  { href: '/dashboard/schools/emis', label: 'EMIS' },
  { href: '/dashboard/schools/staff', label: 'Staff' },
  { href: '/dashboard/schools/approved-list', label: 'Approved' },
  { href: '/dashboard/schools/menu', label: 'Menu' },
  { href: '/dashboard/schools/agency', label: 'DBE' },
  { href: '/dashboard/schools/agency-report', label: 'Agency pack' },
  { href: '/dashboard/schools/visits', label: 'Visits' },
  { href: '/dashboard/schools/isps', label: 'ISPs' },
  { href: '/dashboard/schools/isp-sla', label: 'ISP SLA' },
  { href: '/dashboard/schools/orders', label: 'Orders' },
  { href: '/dashboard/schools/kitchen', label: 'Kitchen' },
  { href: '/dashboard/schools/feeding', label: 'Feed' },
  { href: '/dashboard/schools/attendance', label: 'Attendance' },
  { href: '/dashboard/schools/claims', label: 'Claims' },
  { href: '/dashboard/schools/compliance', label: 'Compliance' },
  { href: '/dashboard/schools/prizes', label: 'Prizes' },
  { href: '/dashboard/schools/audit', label: 'Audit' },
  { href: '/dashboard/schools/report', label: 'Report' },
  { href: '/dashboard/schools/map', label: 'Map' },
] as const;

export function SchoolsNav() {
  return <RelationshipNav items={SCHOOLS_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Schools / NSNP">{children}</CompanyGate>;
}

export function SchoolsHeader({
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
  showNav?: boolean;
}) {
  return (
    <RelationshipHeader
      backHref="/dashboard/schools"
      backLabel="Schools overview"
      eyebrow="NSNP · Schools programme"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
      nav={showNav ? <SchoolsNav /> : undefined}
    />
  );
}

export function SchoolsPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
