/**
 * Client-safe sales agreement copy.
 * The full contract HTML lives in agreement.ts and must not ship to the browser.
 */

export const SALES_CONTRACTOR_EMAIL_DOMAIN = 'bigfivegroup.africa';

/** The only performance KPIs under the sales contractor agreement. */
export const SALES_CONTRACTOR_KPIS = [
  {
    key: 'leadership',
    title: 'Apply the leadership model to your life',
    detail:
      'Actively apply the Super-Cube® leadership model (Choices, Principles, Mental, Emotional, Physical and Spiritual) in personal and professional conduct, complete the Portal leadership training, and demonstrate growth over time.',
  },
  {
    key: 'increase_sales',
    title: 'Increase sales',
    detail:
      'Grow qualifying closed / paid sales of the Company’s products and services in line with authorised pricing, brand standards and Portal workflows.',
  },
  {
    key: 'reduce_costs',
    title: 'Reduce costs',
    detail:
      'Help the Company reduce avoidable cost and waste — including efficient use of tools and travel, accurate quoting, fewer failed deals and rework, and commercial discipline that protects margin.',
  },
] as const;
