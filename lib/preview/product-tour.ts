/**
 * Guided product tour over the /preview sample screens.
 * Navigation only — this module does not read or write a database.
 */
import type { DictKey } from '@/lib/i18n/dict/en';

export const TOUR_TRIAL_HREF = '/onboarding?lane=b2b';
export const TOUR_DEMO_HREF = '/#book-demo';

export const PRODUCT_TOUR_STEP_IDS = [
  'dashboard',
  'crm',
  'srm',
  'po',
  'inventory',
  'ratings',
  'sheq',
  'close',
] as const;

export type ProductTourStepId = (typeof PRODUCT_TOUR_STEP_IDS)[number];

export type ProductTourStep = {
  id: ProductTourStepId;
  path: string;
  titleKey: DictKey;
  bodyKey: DictKey;
  final?: boolean;
};

export const PRODUCT_TOUR_STEPS: readonly ProductTourStep[] = [
  {
    id: 'dashboard',
    path: '/preview/dashboard',
    titleKey: 'tour.dashboard.title',
    bodyKey: 'tour.dashboard.body',
  },
  {
    id: 'crm',
    path: '/preview/crm',
    titleKey: 'tour.crm.title',
    bodyKey: 'tour.crm.body',
  },
  {
    id: 'srm',
    path: '/preview/srm',
    titleKey: 'tour.srm.title',
    bodyKey: 'tour.srm.body',
  },
  {
    id: 'po',
    path: '/preview/po',
    titleKey: 'tour.po.title',
    bodyKey: 'tour.po.body',
  },
  {
    id: 'inventory',
    path: '/preview/inventory',
    titleKey: 'tour.inventory.title',
    bodyKey: 'tour.inventory.body',
  },
  {
    id: 'ratings',
    path: '/preview/ratings',
    titleKey: 'tour.ratings.title',
    bodyKey: 'tour.ratings.body',
  },
  {
    id: 'sheq',
    path: '/preview/sheq',
    titleKey: 'tour.sheq.title',
    bodyKey: 'tour.sheq.body',
  },
  {
    id: 'close',
    path: '/preview/sheq',
    titleKey: 'tour.close.title',
    bodyKey: 'tour.close.body',
    final: true,
  },
];

export function isProductTourStepId(value: string | null | undefined): value is ProductTourStepId {
  return PRODUCT_TOUR_STEP_IDS.some((id) => id === value);
}

/** Sample-screen URL for one coach mark. English omits the lang query. */
export function productTourHref(id: ProductTourStepId = 'dashboard', locale?: string | null): string {
  const step = PRODUCT_TOUR_STEPS.find((item) => item.id === id) ?? PRODUCT_TOUR_STEPS[0];
  const params = new URLSearchParams({ tour: '1', step: step.id });
  if (locale && locale !== 'en') params.set('lang', locale);
  return `${step.path}?${params.toString()}`;
}

function normalizePath(pathname: string): string {
  const path = (pathname.split('?')[0] || '/').replace(/\/$/, '') || '/';
  return path;
}

/** Match the coach mark to the open sample screen. The path wins over a stale step id. */
export function resolveTourStep(pathname: string, stepParam: string | null): ProductTourStep {
  const path = normalizePath(pathname);
  const requested = PRODUCT_TOUR_STEPS.find((item) => item.id === stepParam);
  if (requested?.final && path === requested.path) return requested;
  if (requested && !requested.final && (path === requested.path || path.startsWith(`${requested.path}/`))) {
    return requested;
  }
  const screen = PRODUCT_TOUR_STEPS.find(
    (item) => !item.final && (path === item.path || path.startsWith(`${item.path}/`))
  );
  return screen ?? PRODUCT_TOUR_STEPS[0];
}
