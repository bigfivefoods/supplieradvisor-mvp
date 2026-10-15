/**
 * Sidebar sections for RecoverAdvisor®.
 * Briefs B–K append children here. Only pages that exist are listed,
 * because the nav integrity check rejects a dead href.
 */
export type RecoverNavChild = {
  label: string;
  href: string;
  exact?: boolean;
  desc?: string;
  /** Queue label is chosen from the resolved role at render time. */
  roleLabel?: 'queue';
};

export type RecoverNavSection = {
  label: string;
  children: readonly RecoverNavChild[];
};

export const RECOVERGRAPH_NAV_SECTIONS: readonly RecoverNavSection[] = [
  {
    label: 'Overview',
    children: [
      {
        label: 'Command centre',
        href: '/dashboard/recovergraph',
        exact: true,
        desc: 'Workspace setup and today’s picture',
      },
    ],
  },
  {
    label: 'Work',
    children: [
      {
        label: 'Queue',
        href: '/dashboard/recovergraph/queue',
        desc: 'Accounts waiting for work',
        roleLabel: 'queue',
      },
    ],
  },
  {
    label: 'Place',
    children: [
      {
        label: 'Creditors',
        href: '/dashboard/recovergraph/creditors',
        desc: 'Clients who place accounts',
      },
      {
        label: 'Mandates',
        href: '/dashboard/recovergraph/mandates',
        desc: 'Authority to collect',
      },
    ],
  },
  {
    label: 'Setup',
    children: [
      {
        label: 'Team & registrations',
        href: '/dashboard/recovergraph/settings/team',
        desc: 'Operator, CFDC and staff',
      },
      {
        label: 'Portals & install',
        href: '/dashboard/recovergraph/settings/portals',
        desc: 'Creditor, debtor and attorney access',
      },
    ],
  },
];

export function recovergraphNavSteps(): Array<{
  name: string;
  href: string;
  exact?: boolean;
  desc?: string;
  section: string;
}> {
  return RECOVERGRAPH_NAV_SECTIONS.flatMap((section) =>
    section.children.map((child) => ({
      name: child.label,
      href: child.href,
      exact: child.exact,
      desc: child.desc,
      section: section.label,
    }))
  );
}
