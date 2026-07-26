'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';
import { PROCESS_STEPS } from '@/lib/schools/process';

/** Daily path — kitchen & principal every school day */
export const SCHOOLS_DAILY_NAV: readonly NavItem[] = [
  { href: '/dashboard/schools', label: 'Command', exact: true },
  { href: '/dashboard/schools/serve-day', label: 'Serve day' },
  { href: '/dashboard/schools/kitchen', label: 'Kitchen' },
  { href: '/dashboard/schools/orders', label: 'Orders' },
  { href: '/dashboard/schools/surveys', label: 'Surveys' },
  { href: '/dashboard/schools/claims', label: 'Claims' },
] as const;

/** School setup & registers */
export const SCHOOLS_SETUP_NAV: readonly NavItem[] = [
  { href: '/dashboard/schools/profile', label: 'School' },
  { href: '/dashboard/schools/learners', label: 'Learners' },
  { href: '/dashboard/schools/emis', label: 'EMIS' },
  { href: '/dashboard/schools/staff', label: 'Staff' },
  { href: '/dashboard/schools/menu', label: 'Menu' },
  { href: '/dashboard/schools/approved-list', label: 'Approved' },
  { href: '/dashboard/schools/isps', label: 'ISPs' },
  { href: '/dashboard/schools/agency', label: 'Join DBE' },
] as const;

/** Quality, funding, improvement */
export const SCHOOLS_GOVERN_NAV: readonly NavItem[] = [
  { href: '/dashboard/schools/compliance', label: 'Compliance' },
  { href: '/dashboard/schools/audit', label: 'Audit' },
  { href: '/dashboard/schools/prizes', label: 'Prizes' },
  { href: '/dashboard/schools/report', label: 'Report' },
  { href: '/dashboard/schools/riad', label: 'RIAD' },
  { href: '/dashboard/schools/maintenance', label: 'Maintain' },
  { href: '/dashboard/schools/map', label: 'Map' },
] as const;

/** DBE / PEU / provincial agency */
export const AGENCY_NAV: readonly NavItem[] = [
  { href: '/dashboard/schools', label: 'Command', exact: true },
  { href: '/dashboard/schools/agency', label: 'Schools' },
  { href: '/dashboard/schools/agency-report', label: 'Agency pack' },
  { href: '/dashboard/schools/approved-list', label: 'Approved list' },
  { href: '/dashboard/schools/visits', label: 'PEU visits' },
  { href: '/dashboard/schools/isp-sla', label: 'ISP SLA' },
  { href: '/dashboard/schools/prizes', label: 'Prizes' },
  { href: '/dashboard/schools/map', label: 'Map' },
] as const;

/** Full flat nav (legacy / search) — process order */
export const SCHOOLS_NAV: readonly NavItem[] = [
  ...SCHOOLS_DAILY_NAV,
  ...SCHOOLS_SETUP_NAV.filter(
    (n) => !SCHOOLS_DAILY_NAV.some((d) => d.href === n.href)
  ),
  ...SCHOOLS_GOVERN_NAV,
  { href: '/dashboard/schools/agency-report', label: 'Agency pack' },
  { href: '/dashboard/schools/visits', label: 'Visits' },
  { href: '/dashboard/schools/isp-sla', label: 'ISP SLA' },
  { href: '/dashboard/schools/feeding', label: 'Feed log' },
  { href: '/dashboard/schools/attendance', label: 'Attendance' },
] as const;

export function SchoolsNav({ mode = 'school' }: { mode?: 'school' | 'agency' }) {
  if (mode === 'agency') {
    return <RelationshipNav items={AGENCY_NAV} />;
  }
  // Principal: daily-first, not 25 equal links
  const items: NavItem[] = [
    ...SCHOOLS_DAILY_NAV,
    { href: '/dashboard/schools/learners', label: 'Learners' },
    { href: '/dashboard/schools/menu', label: 'Menu' },
    { href: '/dashboard/schools/profile', label: 'School' },
    { href: '/dashboard/schools/agency', label: 'DBE' },
    { href: '/dashboard/schools/riad', label: 'RIAD' },
    { href: '/dashboard/schools/maintenance', label: 'Maintain' },
    { href: '/dashboard/schools/audit', label: 'Audit' },
    { href: '/dashboard/schools/prizes', label: 'Prizes' },
    { href: '/dashboard/schools/report', label: 'Report' },
  ];
  return <RelationshipNav items={items} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Schools / NSNP">{children}</CompanyGate>;
}

export function SchoolsHeader({
  title,
  description,
  action,
  titleAccent,
  /** In-page process pills — off by default; module chrome navbar is the nav. */
  showNav = false,
  mode = 'school',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  titleAccent?: string;
  showNav?: boolean;
  mode?: 'school' | 'agency';
}) {
  return (
    <RelationshipHeader
      backHref="/dashboard/schools"
      backLabel="NSNP command"
      eyebrow={
        mode === 'agency'
          ? 'DBE · PEU · Provincial programme'
          : 'NSNP · School kitchen programme'
      }
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
      nav={showNav ? <SchoolsNav mode={mode} /> : undefined}
    />
  );
}

export function SchoolsPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}

/** Process deep-links for hub tiles */
export function processLinksForRole(role: 'school' | 'agency') {
  return PROCESS_STEPS.filter((s) =>
    role === 'agency' ? s.agency : s.school
  );
}
