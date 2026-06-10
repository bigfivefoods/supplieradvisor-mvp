/**
 * Modular company verification system.
 *
 * To add a new country authority:
 *  1. Add an entry to VERIFICATION_AUTHORITIES.
 *  2. Implement (or stub) the corresponding verifyXxx function.
 *  3. Register it in the handlers map inside verifyCompanyRegistration.
 */

export interface VerificationAuthority {
  /** Short identifier shown in the UI and stored on the profile */
  id: string;
  /** Human-readable name */
  name: string;
  /** Country (or countries) this authority covers */
  countries: string[];
  /** Official website */
  website: string;
  /** Whether a live API is wired up (false = mock/placeholder) */
  liveIntegration: boolean;
}

export interface VerificationResult {
  success: boolean;
  authority: VerificationAuthority;
  /** Data returned (or simulated) by the authority */
  data: {
    registrationNumber: string;
    companyName?: string;
    status?: string;
    registeredDate?: string;
    directorCount?: number;
    taxStatus?: string;
    vatStatus?: string;
    [key: string]: unknown;
  };
  /** ISO timestamp of the verification check */
  verifiedAt: string;
  /** Error message if success === false */
  error?: string;
}

// ─── Authority registry ───────────────────────────────────────────────────────

export const VERIFICATION_AUTHORITIES: Record<string, VerificationAuthority> = {
  CIPC: {
    id: 'CIPC',
    name: 'Companies and Intellectual Property Commission (CIPC)',
    countries: ['South Africa'],
    website: 'https://www.cipc.co.za',
    liveIntegration: false,
  },
  SARS: {
    id: 'SARS',
    name: 'South African Revenue Service (SARS)',
    countries: ['South Africa'],
    website: 'https://www.sars.gov.za',
    liveIntegration: false,
  },
  'CAC-Nigeria': {
    id: 'CAC-Nigeria',
    name: 'Corporate Affairs Commission (CAC) — Nigeria',
    countries: ['Nigeria'],
    website: 'https://www.cac.gov.ng',
    liveIntegration: false,
  },
  'CompaniesHouse-UK': {
    id: 'CompaniesHouse-UK',
    name: 'Companies House — United Kingdom',
    countries: ['United Kingdom'],
    website: 'https://find-and-update.company-information.service.gov.uk',
    liveIntegration: false,
  },
  'ASIC-Australia': {
    id: 'ASIC-Australia',
    name: 'Australian Securities & Investments Commission (ASIC)',
    countries: ['Australia'],
    website: 'https://www.asic.gov.au',
    liveIntegration: false,
  },
  'MCA-India': {
    id: 'MCA-India',
    name: 'Ministry of Corporate Affairs (MCA) — India',
    countries: ['India'],
    website: 'https://www.mca.gov.in',
    liveIntegration: false,
  },
  'SEC-Nigeria': {
    id: 'SEC-Nigeria',
    name: 'Securities and Exchange Commission — Nigeria',
    countries: ['Nigeria'],
    website: 'https://sec.gov.ng',
    liveIntegration: false,
  },
  Generic: {
    id: 'Generic',
    name: 'Generic Business Registry',
    countries: [],
    website: '',
    liveIntegration: false,
  },
};

/** Map each country to its primary registration authority. */
const COUNTRY_TO_PRIMARY_AUTHORITY: Record<string, string> = {
  'South Africa': 'CIPC',
  Nigeria: 'CAC-Nigeria',
  'United Kingdom': 'CompaniesHouse-UK',
  Australia: 'ASIC-Australia',
  India: 'MCA-India',
};

/**
 * Returns the primary verification authority for a given country.
 * Falls back to the Generic authority for unmapped countries.
 */
export function getVerificationAuthority(country: string): VerificationAuthority {
  const authorityId = COUNTRY_TO_PRIMARY_AUTHORITY[country] ?? 'Generic';
  return VERIFICATION_AUTHORITIES[authorityId];
}

// ─── Mock / placeholder API functions ────────────────────────────────────────

/** Simulates a network delay of 800 – 1 400 ms */
function mockDelay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600));
}

/**
 * CIPC (South Africa) — placeholder integration.
 * Replace the body of this function with a real fetch() call when the
 * CIPC API credentials are available.
 *
 * Endpoint (future): POST https://api.cipc.co.za/company/verify
 */
async function verifyCIPC(
  registrationNumber: string,
  companyName: string,
): Promise<VerificationResult> {
  await mockDelay();

  // TODO: replace with real CIPC API call
  // const response = await fetch('https://api.cipc.co.za/company/verify', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': '******',
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ registrationNumber }),
  // });
  // const data = await response.json();

  return {
    success: true,
    authority: VERIFICATION_AUTHORITIES['CIPC'],
    data: {
      registrationNumber,
      companyName: companyName || `Mock Company (${registrationNumber})`,
      status: 'Active',
      registeredDate: '2019-03-15',
      directorCount: 2,
    },
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * SARS (South Africa) — placeholder integration.
 * Replace the body of this function with a real SARS eFiling / API call.
 *
 * Endpoint (future): POST https://efiling.sars.gov.za/api/taxpayer/verify
 */
async function verifySARS(
  taxNumber: string,
  companyName: string,
): Promise<VerificationResult> {
  await mockDelay();

  // TODO: replace with real SARS API call
  // const response = await fetch('https://efiling.sars.gov.za/api/taxpayer/verify', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': '******',
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ taxNumber }),
  // });
  // const data = await response.json();

  return {
    success: true,
    authority: VERIFICATION_AUTHORITIES['SARS'],
    data: {
      registrationNumber: taxNumber,
      companyName: companyName || `Mock Company (${taxNumber})`,
      taxStatus: 'Compliant',
      vatStatus: 'Registered',
    },
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * CAC Nigeria — placeholder integration.
 * Replace the body of this function with a real CAC Public Search API call.
 *
 * Endpoint (future): GET https://search.cac.gov.ng/api/entity/{registrationNumber}
 */
async function verifyCACNigeria(
  registrationNumber: string,
  companyName: string,
): Promise<VerificationResult> {
  await mockDelay();

  // TODO: replace with real CAC API call
  // const response = await fetch(
  //   `https://search.cac.gov.ng/api/entity/${encodeURIComponent(registrationNumber)}`,
  //   { headers: { 'x-api-key': process.env.CAC_NIGERIA_API_KEY ?? '' } }
  // );
  // const data = await response.json();

  return {
    success: true,
    authority: VERIFICATION_AUTHORITIES['CAC-Nigeria'],
    data: {
      registrationNumber,
      companyName: companyName || `Mock Company (${registrationNumber})`,
      status: 'Incorporated',
      registeredDate: '2021-07-20',
      directorCount: 3,
    },
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Companies House UK — placeholder integration.
 * A free REST API is available; wire it up when the API key is ready.
 *
 * Endpoint (future): GET https://api.company-information.service.gov.uk/company/{companyNumber}
 */
async function verifyCompaniesHouseUK(
  registrationNumber: string,
  companyName: string,
): Promise<VerificationResult> {
  await mockDelay();

  // TODO: replace with real Companies House API call
  // const response = await fetch(
  //   `https://api.company-information.service.gov.uk/company/${encodeURIComponent(registrationNumber)}`,
  //   { headers: { 'Authorization': `Basic ${btoa(process.env.COMPANIES_HOUSE_API_KEY + ':')}` } }
  // );
  // const data = await response.json();

  return {
    success: true,
    authority: VERIFICATION_AUTHORITIES['CompaniesHouse-UK'],
    data: {
      registrationNumber,
      companyName: companyName || `Mock Company (${registrationNumber})`,
      status: 'Active',
      registeredDate: '2018-11-01',
      directorCount: 1,
    },
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * ASIC Australia — placeholder integration.
 */
async function verifyASICAustralia(
  registrationNumber: string,
  companyName: string,
): Promise<VerificationResult> {
  await mockDelay();

  return {
    success: true,
    authority: VERIFICATION_AUTHORITIES['ASIC-Australia'],
    data: {
      registrationNumber,
      companyName: companyName || `Mock Company (${registrationNumber})`,
      status: 'Registered',
      registeredDate: '2020-05-10',
    },
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * MCA India — placeholder integration.
 */
async function verifyMCAIndia(
  registrationNumber: string,
  companyName: string,
): Promise<VerificationResult> {
  await mockDelay();

  return {
    success: true,
    authority: VERIFICATION_AUTHORITIES['MCA-India'],
    data: {
      registrationNumber,
      companyName: companyName || `Mock Company (${registrationNumber})`,
      status: 'Active',
      registeredDate: '2017-02-28',
    },
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Generic fallback — used when no specific authority is mapped for the country.
 */
async function verifyGeneric(
  registrationNumber: string,
  companyName: string,
  country: string,
): Promise<VerificationResult> {
  await mockDelay();

  return {
    success: true,
    authority: {
      ...VERIFICATION_AUTHORITIES['Generic'],
      name: `Business Registry — ${country || 'Unknown Country'}`,
    },
    data: {
      registrationNumber,
      companyName: companyName || `Mock Company (${registrationNumber})`,
      status: 'Verified',
    },
    verifiedAt: new Date().toISOString(),
  };
}

// ─── Unified entry point ──────────────────────────────────────────────────────

export interface VerifyCompanyParams {
  country: string;
  registrationNumber: string;
  taxNumber?: string;
  companyName?: string;
  /** Override the auto-detected authority */
  authorityId?: string;
}

/**
 * Verify a company against the appropriate national authority.
 *
 * The authority is determined by `params.country` unless `params.authorityId`
 * is explicitly provided.  All non-SA countries currently use mock/placeholder
 * implementations that can be swapped for real API calls without changing the
 * call site.
 */
export async function verifyCompanyRegistration(
  params: VerifyCompanyParams,
): Promise<VerificationResult> {
  const { country, registrationNumber, taxNumber, companyName = '', authorityId } = params;

  const authority = authorityId
    ? (VERIFICATION_AUTHORITIES[authorityId] ?? getVerificationAuthority(country))
    : getVerificationAuthority(country);

  try {
    switch (authority.id) {
      case 'CIPC':
        return await verifyCIPC(registrationNumber, companyName);

      case 'SARS':
        return await verifySARS(taxNumber || registrationNumber, companyName);

      case 'CAC-Nigeria':
        return await verifyCACNigeria(registrationNumber, companyName);

      case 'CompaniesHouse-UK':
        return await verifyCompaniesHouseUK(registrationNumber, companyName);

      case 'ASIC-Australia':
        return await verifyASICAustralia(registrationNumber, companyName);

      case 'MCA-India':
        return await verifyMCAIndia(registrationNumber, companyName);

      default:
        return await verifyGeneric(registrationNumber, companyName, country);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return {
      success: false,
      authority,
      data: { registrationNumber },
      verifiedAt: new Date().toISOString(),
      error: message,
    };
  }
}
