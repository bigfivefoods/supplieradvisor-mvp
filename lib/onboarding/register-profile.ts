/**
 * Facts the business wizard must store so the company profile, discover,
 * and quote / purchase-order defaults already have them.
 */
import {
  COMPANY_INDUSTRIES,
  subIndustriesFor,
  type EconomicSectorId,
} from '@/lib/business/industries';
import { CURRENCIES, DEFAULT_PAYMENT_TERMS_OPTIONS } from '@/lib/business/types';

const CATALOGUE = new Set<string>(COMPANY_INDUSTRIES);
const CURRENCY_SET = new Set<string>(CURRENCIES);
const TERMS = new Set<string>(DEFAULT_PAYMENT_TERMS_OPTIONS);

/** Packaging sector id → the company-profile economic sector. */
export function economicSectorForOsSector(
  osSector: string | null | undefined
): EconomicSectorId | null {
  const id = String(osSector || '').trim();
  if (
    id === 'primary' ||
    id === 'secondary' ||
    id === 'tertiary' ||
    id === 'quaternary' ||
    id === 'quinary'
  ) {
    return id;
  }
  if (id === 'public_sector') return 'quinary';
  return null;
}

export type GovernmentWorkspaceSeed = {
  industryId: string;
  businessTypeId: string;
  catalogue: string[];
};

/** Government office → workspace industry, business type, and catalogue names. */
export function governmentWorkspaceSeed(
  legalForm: string | null | undefined
): GovernmentWorkspaceSeed | null {
  switch (String(legalForm || '').trim()) {
    case 'national':
      return {
        industryId: 'public_national',
        businessTypeId: 'nat_agency',
        catalogue: ['Central government'],
      };
    case 'provincial':
      return {
        industryId: 'public_provincial',
        businessTypeId: 'prov_other',
        catalogue: ['Provincial government'],
      };
    case 'municipal':
      return {
        industryId: 'public_municipal',
        businessTypeId: 'local_muni',
        catalogue: ['Local government'],
      };
    case 'government_education':
      return {
        industryId: 'public_provincial',
        businessTypeId: 'prov_dbe',
        catalogue: [
          'Department of Basic Education (DBE)',
          'Provincial government',
        ],
      };
    case 'government_health':
      return {
        industryId: 'public_provincial',
        businessTypeId: 'prov_health',
        catalogue: ['Department of Health (DoH)', 'Provincial government'],
      };
    default:
      return null;
  }
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function nameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export type RegistrationProfileFacts = {
  industries: string[] | null;
  industry: string | null;
  sub_industries: string[] | null;
  sub_industry: string | null;
  vat_number: string | null;
  website: string | null;
  short_description: string | null;
  description: string | null;
  country: string;
  city: string | null;
  province: string | null;
  region: string | null;
  continent: string | null;
  street: string | null;
  address: string | null;
  postal_code: string | null;
  primary_currency: string;
  settings: {
    timezone: string;
    primary_currency: string;
    defaultPaymentTerms: string;
    paymentTermsOptions: string[];
  };
};

/**
 * Keep catalogue names that exist, and sub-industries that belong to them.
 * When no catalogue name was chosen, keep the workspace labels already sent.
 */
export function registrationProfileFacts(input: {
  catalogueIndustries?: unknown;
  subIndustries?: unknown;
  fallbackIndustries?: unknown;
  vatNumber?: unknown;
  website?: unknown;
  shortDescription?: unknown;
  country?: unknown;
  city?: unknown;
  province?: unknown;
  continent?: unknown;
  street?: unknown;
  postalCode?: unknown;
  currency?: unknown;
  paymentTerms?: unknown;
}): RegistrationProfileFacts {
  const catalogue = [...new Set(nameList(input.catalogueIndustries))].filter((name) =>
    CATALOGUE.has(name)
  );
  const fallback = [...new Set(nameList(input.fallbackIndustries))];
  const industries = catalogue.length ? catalogue : fallback;
  const allowedSubs = new Set(subIndustriesFor(catalogue));
  const subs = [...new Set(nameList(input.subIndustries))].filter((name) =>
    allowedSubs.has(name)
  );
  const currencyRaw = String(input.currency || 'ZAR')
    .trim()
    .toUpperCase();
  const currency = CURRENCY_SET.has(currencyRaw) ? currencyRaw : 'ZAR';
  const termsRaw = String(input.paymentTerms || 'Net 30').trim();
  const terms = TERMS.has(termsRaw) ? termsRaw : 'Net 30';
  const about = clean(input.shortDescription);
  const street = clean(input.street);
  const province = clean(input.province);
  return {
    industries: industries.length ? industries : null,
    industry: industries[0] || null,
    sub_industries: subs.length ? subs : null,
    sub_industry: subs[0] || null,
    vat_number: clean(input.vatNumber),
    website: clean(input.website),
    short_description: about,
    description: about,
    country: clean(input.country) || 'South Africa',
    city: clean(input.city),
    province,
    region: province,
    continent: clean(input.continent),
    street,
    address: street,
    postal_code: clean(input.postalCode),
    primary_currency: currency,
    settings: {
      timezone: 'Africa/Johannesburg',
      primary_currency: currency,
      defaultPaymentTerms: terms,
      paymentTermsOptions: [...DEFAULT_PAYMENT_TERMS_OPTIONS],
    },
  };
}
