/**
 * Day 1–3 golden path for new companies.
 */

export type OnboardingStepId =
  | 'profile'
  | 'team'
  | 'invite_partners'
  | 'first_trade'
  | 'billing'
  | 'rate_partner';

export type OnboardingStep = {
  id: OnboardingStepId;
  day: 1 | 2 | 3;
  title: string;
  body: string;
  href: string;
  cta: string;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'profile',
    day: 1,
    title: 'Complete company profile',
    body: 'Trading name, contacts, and industry so partners can find and trust you.',
    href: '/dashboard/my-business/profile',
    cta: 'Edit profile',
  },
  {
    id: 'team',
    day: 1,
    title: 'Invite your team',
    body: 'Add owners, ops, and finance with the right roles.',
    href: '/dashboard/my-business/team',
    cta: 'Open team',
  },
  {
    id: 'invite_partners',
    day: 2,
    title: 'Invite 3 trading partners',
    body: 'Suppliers or customers — grow the verified network you actually trade with.',
    href: '/dashboard/invite-business',
    cta: 'Invite business',
  },
  {
    id: 'first_trade',
    day: 3,
    title: 'Create first quote, PO, or order',
    body: 'Put real commerce on the platform — the trust loop starts here.',
    href: '/dashboard/customers/quotes',
    cta: 'Start a quote',
  },
  {
    id: 'billing',
    day: 3,
    title: 'Review billing & trial',
    body: 'See your trial end date and prepaid options before you need to pay.',
    href: '/dashboard/my-business/billing',
    cta: 'Open billing',
  },
  {
    id: 'rate_partner',
    day: 3,
    title: 'Rate a partner after trade',
    body: 'Peer stars from suppliers and customers build OTIFEF and trust for everyone.',
    href: '/dashboard/suppliers/ratings',
    cta: 'Open ratings',
  },
] as const;

export function progressPercent(steps: Record<string, boolean>): number {
  const total = ONBOARDING_STEPS.length;
  const done = ONBOARDING_STEPS.filter((s) => steps[s.id]).length;
  return Math.round((done / total) * 100);
}
