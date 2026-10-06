export const ZA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;

export type CountryFieldDefinition = {
  country_code: string;
  registration_format: RegExp;
  registration_hint: string;
  vat_format?: RegExp;
  vat_hint?: string;
  branch_code_format?: RegExp;
  branch_code_hint?: string;
  allows_sa_id: boolean;
  provinces?: readonly string[];
};

export const CREDIT_FIELD_DEFS: Record<string, CountryFieldDefinition> = {
  ZA: {
    country_code: 'ZA',
    registration_format: /^\d{4}\/\d{6}\/\d{2}$/,
    registration_hint: 'YYYY/NNNNNN/NN',
    vat_format: /^4\d{9}$/,
    vat_hint: '10 digits starting with 4',
    branch_code_format: /^\d{6}$/,
    branch_code_hint: '6 digits',
    allows_sa_id: true,
    provinces: ZA_PROVINCES,
  },
  DEFAULT: {
    country_code: 'DEFAULT',
    registration_format: /^[A-Za-z0-9\-\s\/]{3,80}$/,
    registration_hint: 'Company registration number',
    vat_format: /^[A-Za-z0-9\-\s]{3,40}$/,
    vat_hint: 'Tax/VAT number',
    branch_code_format: /^[A-Za-z0-9\-\s]{2,20}$/,
    branch_code_hint: 'Branch code',
    allows_sa_id: false,
  },
};

export function fieldDefForCountry(countryCode: unknown): CountryFieldDefinition {
  const key = String(countryCode || 'ZA').trim().toUpperCase();
  return CREDIT_FIELD_DEFS[key] || CREDIT_FIELD_DEFS.DEFAULT;
}
