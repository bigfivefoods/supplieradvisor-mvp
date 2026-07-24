'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

/**
 * Intelligence process steps — used by ModuleProcessBar via lib/chrome/module-nav.
 * Kept here for reference / any consumer that needs the same list.
 * Do not re-render this nav on page bodies (would duplicate the top navbar).
 */
export const INTELLIGENCE_NAV: readonly NavItem[] = [
  { href: '/dashboard/intelligence', label: 'Command', exact: true },
  { href: '/dashboard/intelligence/pulse-dashboard', label: 'Pulse' },
  { href: '/dashboard/intelligence/neural-insights', label: 'Insights' },
  { href: '/dashboard/intelligence/predictive-forecasts', label: 'Forecast' },
  { href: '/dashboard/intelligence/custom-scorecards', label: 'Scorecards' },
  { href: '/dashboard/intelligence/simulation-lab', label: 'Lab' },
  { href: '/dashboard/intelligence/leadership-development', label: 'Lead' },
] as const;

/** @deprecated Prefer ModuleProcessBar — left for rare external use */
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
  backHref = '/dashboard/intelligence',
  backLabel = 'Intelligence',
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  titleAccent?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <RelationshipHeader
      backHref={backHref}
      backLabel={backLabel}
      eyebrow="Business intelligence"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

/** Page chrome only — key functions stay in the top process navbar. */
export function IntelligencePage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
