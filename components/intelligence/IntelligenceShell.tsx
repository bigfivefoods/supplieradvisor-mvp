'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

/** Intelligence nav — command + live BI + leadership */
export const INTELLIGENCE_NAV: readonly NavItem[] = [
  { href: '/dashboard/intelligence', label: 'Command', exact: true },
  { href: '/dashboard/intelligence/pulse-dashboard', label: 'Pulse' },
  { href: '/dashboard/intelligence/neural-insights', label: 'Insights' },
  { href: '/dashboard/intelligence/predictive-forecasts', label: 'Forecast' },
  { href: '/dashboard/intelligence/custom-scorecards', label: 'Scorecards' },
  { href: '/dashboard/intelligence/leadership-development', label: 'Leadership' },
  { href: '/dashboard/intelligence/simulation-lab', label: 'Lab' },
] as const;


export function IntelligenceNav() {
  return <RelationshipNav items={INTELLIGENCE_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Intelligence">{children}</CompanyGate>;
}


export function IntelligenceHeader({
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
      backHref="/dashboard/intelligence"
      backLabel="Intelligence"
      eyebrow="Business intelligence"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function IntelligencePage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
