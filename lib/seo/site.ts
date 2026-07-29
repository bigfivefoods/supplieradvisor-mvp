/**
 * Canonical site constants for SEO (sitemap, robots, JSON-LD, metadata).
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.supplieradvisor.com'
).replace(/\/$/, '');

export const SITE_NAME = 'SupplierAdvisor®';
export const SITE_NAME_PLAIN = 'SupplierAdvisor';

export const DEFAULT_TITLE =
  'SupplierAdvisor® — The world’s most trusted supplier advice — and OS';

export const DEFAULT_DESCRIPTION =
  'SupplierAdvisor® is the supply-chain OS — not Excel, not accounting-only, not a multi-year ERP. B2B, B2G & B2C on one verified network: SRM, CRM, inventory, manufacturing, finance, SHEQ, people, containers. 30-day free trial. From R299/mo.';

/** Core marketing + public indexable routes (no company/product dynamic pages). */
export const STATIC_SEO_ROUTES: Array<{
  path: string;
  changeFrequency:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/marketplace', changeFrequency: 'daily', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/demo', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/industries', changeFrequency: 'weekly', priority: 0.88 },
  { path: '/industries/food-beverage', changeFrequency: 'monthly', priority: 0.78 },
  { path: '/industries/agriculture', changeFrequency: 'monthly', priority: 0.78 },
  { path: '/industries/manufacturing', changeFrequency: 'monthly', priority: 0.78 },
  { path: '/industries/distribution', changeFrequency: 'monthly', priority: 0.78 },
  { path: '/industries/public-sector', changeFrequency: 'monthly', priority: 0.78 },
  { path: '/industries/multi-entity', changeFrequency: 'monthly', priority: 0.78 },
  { path: '/verification-sla', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

export const SITE_KEYWORDS = [
  'SupplierAdvisor',
  'supplier advisor',
  'supply chain software',
  'supply chain operating system',
  'B2B marketplace',
  'B2G procurement',
  'supplier relationship management',
  'SRM',
  'CRM',
  'inventory management',
  'warehouse management',
  'manufacturing ERP',
  'MPS MRP BOM',
  'distribution software',
  'operations control tower',
  'trade network',
  'verified suppliers',
  'B2B suppliers Africa',
  'South Africa suppliers',
  'CIPC verified suppliers',
  'multi-currency accounting',
  'bank reconciliation',
  'on-chain escrow',
  'Super-Cube leadership',
];
