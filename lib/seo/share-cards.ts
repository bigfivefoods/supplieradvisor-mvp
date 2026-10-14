/**
 * Branded 1200×630 share-card copy for public marketing pages.
 * Prices come from the company subscription constants. No customer stats.
 */
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';
import { INDUSTRIES, type IndustryPage } from '@/lib/marketing/industries';

/** Brand cyan. Keep this exact value in rendered cards. */
export const BRAND_CYAN = '#00b4d8';

export const SHARE_IMAGE_VERSION = '20261014';

export type ShareCardSpec = {
  id: string;
  /** Path under public/, no leading slash. */
  file: string;
  alt: string;
  eyebrow: string;
  headline: string[];
  sub: string[];
  /** Domain path. No registered-mark character. */
  foot: string;
  pricePanel?: {
    amount: string;
    caption: string[];
  };
};

const PRICE_PANEL = {
  amount: `R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}`,
  caption: ['per month', `after ${COMPANY_TRIAL_DAYS}-day`, 'trial'],
};

function wrap(text: string, max = 58, maxLines = 2): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(' ').length;
    if (consumed < words.length) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.endsWith('…') ? last : `${last.replace(/[.,;:]$/, '')}…`;
    }
  }
  return lines;
}

export function shareImageSrc(file: string): string {
  const path = file.startsWith('/') ? file : `/${file}`;
  return `${path}?v=${SHARE_IMAGE_VERSION}`;
}

export const HOME_SHARE_CARD: ShareCardSpec = {
  id: 'home',
  file: 'share/home.png',
  alt: 'SupplierAdvisor® — supply-chain OS with a verified trade and trust layer',
  eyebrow: 'Supply-chain OS',
  headline: ['Verified trade', 'and a trust layer'],
  sub: [
    `SupplierAdvisor® · ${COMPANY_TRIAL_DAYS}-day trial,`,
    `then from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month`,
  ],
  foot: 'supplieradvisor.com',
  pricePanel: PRICE_PANEL,
};

export const PRICING_SHARE_CARD: ShareCardSpec = {
  id: 'pricing',
  file: 'share/pricing.png',
  alt: `SupplierAdvisor® pricing — ${COMPANY_TRIAL_DAYS}-day trial, then from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month`,
  eyebrow: 'Pricing',
  headline: [`${COMPANY_TRIAL_DAYS}-day trial, then`, `from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month`],
  sub: ['SupplierAdvisor® company plan.', 'Unlimited team users.'],
  foot: 'supplieradvisor.com/pricing',
  pricePanel: PRICE_PANEL,
};

export const DEMO_SHARE_CARD: ShareCardSpec = {
  id: 'demo',
  file: 'share/demo.png',
  alt: 'SupplierAdvisor® interactive demo — explore product flows without signing up',
  eyebrow: 'Interactive demo',
  headline: ['Explore the product', 'without signing up'],
  sub: ['SupplierAdvisor® flows for operations,', 'suppliers, finance, quality, and trade.'],
  foot: 'supplieradvisor.com/demo',
};

export const INDUSTRIES_SHARE_CARD: ShareCardSpec = {
  id: 'industries',
  file: 'share/industries.png',
  alt: 'SupplierAdvisor® industries — sector workflows on one supply-chain OS',
  eyebrow: 'Industries',
  headline: ['Sector-ready depth', 'on one OS'],
  sub: ['SupplierAdvisor® for agri, construction,', 'apparel, clinics, gyms, and public programmes.'],
  foot: 'supplieradvisor.com/industries',
};

export const KEY_SHARE_CARDS: ShareCardSpec[] = [
  HOME_SHARE_CARD,
  PRICING_SHARE_CARD,
  DEMO_SHARE_CARD,
  INDUSTRIES_SHARE_CARD,
];

export function industryShareCard(industry: IndustryPage): ShareCardSpec {
  const label = industry.pack || industry.name;
  const blurb = industry.cardBlurb || industry.subhead;
  const branded = blurb.includes('SupplierAdvisor®')
    ? blurb
    : `SupplierAdvisor® · ${blurb}`;
  return {
    id: industry.slug,
    file: `share/industries/${industry.slug}.png`,
    alt: `${industry.name} on SupplierAdvisor®`,
    eyebrow: label,
    headline: [industry.name],
    sub: wrap(branded, 52, 2),
    foot: `supplieradvisor.com/industries/${industry.slug}`,
  };
}

export function allShareCards(): ShareCardSpec[] {
  return [...KEY_SHARE_CARDS, ...INDUSTRIES.map(industryShareCard)];
}

export function shareCardById(id: string): ShareCardSpec | undefined {
  return allShareCards().find((card) => card.id === id);
}
