/** VerifyNow API helpers — https://www.verifynow.co.za */

export type VerifyNowMode = 'sandbox' | 'production';

const VERIFY_BASE = 'https://www.verifynow.co.za/api/external';

function resolveMode(explicit?: VerifyNowMode): VerifyNowMode {
  if (explicit === 'sandbox' || explicit === 'production') return explicit;
  const env = (process.env.VERIFYNOW_MODE as VerifyNowMode) || 'production';
  return env === 'sandbox' ? 'sandbox' : 'production';
}

function getApiKey(): string | null {
  const key = process.env.VERIFYNOW_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

async function postVerifyNow(
  path: '/verify' | '/cipc' | '/bank-account-verification',
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      data: {},
      error: 'VERIFYNOW_API_KEY is not configured on the server',
    };
  }

  try {
    const response = await fetch(`${VERIFY_BASE}${path}`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error:
          String(
            (data as { error?: string; message?: string }).error ||
              (data as { message?: string }).message ||
              `VerifyNow HTTP ${response.status}`
          ) || 'VerifyNow request failed',
      };
    }
    return { ok: true, status: response.status, data };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 500,
      data: {},
      error: e instanceof Error ? e.message : 'VerifyNow network error',
    };
  }
}

/** Standard SA ID Luhn-style checksum (13 digits). */
export function isValidSaIdNumber(id: string): boolean {
  const digits = String(id || '').replace(/\s/g, '');
  if (!/^\d{13}$/.test(digits)) return false;

  // Basic date check YYMMDD
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;

  // Luhn on 13-digit SA ID
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let n = Number(digits[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0 && yy >= 0;
}

/** Loose CIPC registration number check e.g. 2007/013732/07 or 2020/123456/07 */
export function isValidCipcRegistrationNumber(value: string): boolean {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return false;
  // Common formats: YYYY/NNNNNN/NN or KYYYY/NNNNNN/NN (older close corps / entities)
  return /^(K?\d{4}\/\d{6,7}\/\d{2})$/.test(raw);
}

export function parseVerifyNowSaidResult(result: Record<string, unknown>) {
  const results = (result.results || {}) as Record<string, unknown>;
  const said =
    (results.said_verification as Record<string, unknown>) ||
    (results.consumer_trace as Record<string, unknown>) ||
    {};

  const realTime =
    (said.realTimeResults as Record<string, unknown>) ||
    (said as Record<string, unknown>);

  const verification =
    (realTime.Verification as Record<string, unknown>) ||
    (realTime.verification as Record<string, unknown>) ||
    {};

  const statusText = String(
    realTime.Status || realTime.status || said.Status || result.status || ''
  );

  const firstNames = String(
    verification.Firstnames || verification.firstNames || verification.first_names || ''
  ).trim();
  const lastName = String(
    verification.Lastname || verification.lastName || verification.last_name || ''
  ).trim();
  const dob = String(verification.Dob || verification.dob || verification.dateOfBirth || '').trim();

  const successFlag =
    result.success === true ||
    /success|valid|id number valid/i.test(statusText) ||
    (!!firstNames && !!lastName);

  const failed =
    result.success === false ||
    /invalid|failed|error|not found|deceased/i.test(statusText);

  return {
    ok: successFlag && !failed,
    statusText: statusText || (successFlag ? 'Verified' : 'Unknown'),
    firstNames,
    lastName,
    dob,
    requestId: String(result.requestId || result.request_id || ''),
    transactionId: String(
      realTime.transaction_id || said.transaction_id || verification.transaction_id || ''
    ),
    fullName: [firstNames, lastName].filter(Boolean).join(' '),
  };
}

export type CipcCompanyResult = {
  ok: boolean;
  statusText: string;
  companyName: string;
  tradeName: string;
  previousName: string;
  registrationNumber: string;
  registrationDate: string;
  businessStartDate: string;
  companyStatus: string;
  companyType: string;
  sic: string;
  taxNumber: string;
  vatNumber: string;
  physicalAddress: string;
  postalAddress: string;
  directorCount: string;
  requestId: string;
  remainingCredits: number | null;
  mode: string;
  /** Soft match against local trading/legal name */
  nameMatch: 'match' | 'partial' | 'mismatch' | 'unknown';
};

function normalizeCompanyName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|inc|cc|npc|soc|rf)\b\.?/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareCompanyNames(
  localNames: string[],
  remoteName: string,
  remoteTrade?: string
): CipcCompanyResult['nameMatch'] {
  const remotes = [remoteName, remoteTrade || '']
    .map(normalizeCompanyName)
    .filter(Boolean);
  const locals = localNames.map(normalizeCompanyName).filter(Boolean);
  if (!remotes.length || !locals.length) return 'unknown';

  for (const local of locals) {
    for (const remote of remotes) {
      if (local === remote) return 'match';
      if (local.includes(remote) || remote.includes(local)) return 'partial';
      // token overlap: at least 2 significant tokens
      const a = new Set(local.split(' ').filter((t) => t.length > 2));
      const b = new Set(remote.split(' ').filter((t) => t.length > 2));
      let overlap = 0;
      for (const t of a) if (b.has(t)) overlap++;
      if (overlap >= 2) return 'partial';
    }
  }
  return 'mismatch';
}

export function parseVerifyNowCipcResult(
  result: Record<string, unknown>,
  localNames: string[] = []
): CipcCompanyResult {
  const results = (result.results || {}) as Record<string, unknown>;
  // Envelope may put company fields under results or results.company
  const company =
    results.company && typeof results.company === 'object'
      ? (results.company as Record<string, unknown>)
      : results;

  const companyName = String(
    company.company_name || company.companyName || company.CompanyName || ''
  ).trim();
  const tradeName = String(
    company.trade_name || company.tradeName || company.TradeName || ''
  ).trim();
  const previousName = String(company.previous_name || company.previousName || '').trim();
  const registrationNumber = String(
    company.registration_number || company.registrationNumber || ''
  ).trim();
  const companyStatus = String(
    company.status || company.company_status || company.Status || ''
  ).trim();

  const successFlag =
    result.success === true ||
    company.success === true ||
    !!companyName ||
    !!registrationNumber;

  const failedStatus =
    /deregister|liquidat|final de.?reg|business rescue|inactive|not found|invalid|failed/i.test(
      companyStatus
    );

  const ok = successFlag && !failedStatus && result.success !== false;

  let statusText = companyStatus || (ok ? 'Verified' : 'Unknown');
  if (ok && /in business|active|registered/i.test(companyStatus)) {
    statusText = companyStatus;
  }

  const nameMatch = compareCompanyNames(localNames, companyName, tradeName);

  const remaining =
    result.remaining_credits != null
      ? Number(result.remaining_credits)
      : result.remainingCredits != null
        ? Number(result.remainingCredits)
        : null;

  return {
    ok,
    statusText,
    companyName,
    tradeName,
    previousName,
    registrationNumber,
    registrationDate: String(company.registration_date || company.registrationDate || '').trim(),
    businessStartDate: String(
      company.business_start_date || company.businessStartDate || ''
    ).trim(),
    companyStatus,
    companyType: String(company.company_type || company.companyType || '').trim(),
    sic: String(company.sic || '').trim(),
    taxNumber: String(company.tax_number || company.taxNumber || '').trim(),
    vatNumber: String(company.vat_number || company.vatNumber || '').trim(),
    physicalAddress: String(
      company.physical_address || company.physicalAddress || ''
    ).trim(),
    postalAddress: String(company.postal_address || company.postalAddress || '').trim(),
    directorCount: String(company.director_count || company.directorCount || '').trim(),
    requestId: String(result.requestId || result.request_id || ''),
    remainingCredits: Number.isFinite(remaining as number) ? (remaining as number) : null,
    mode: String(result.mode || ''),
    nameMatch,
  };
}

export async function callVerifyNowSaid(params: {
  idNumber: string;
  mode?: VerifyNowMode;
  reportType?: 'said_verification' | 'consumer_trace';
}): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; error?: string }> {
  const mode = resolveMode(params.mode);
  const reportType = params.reportType || 'said_verification';

  return postVerifyNow('/verify', {
    reportType,
    idNumber: params.idNumber.replace(/\s/g, ''),
    mode,
  });
}

/**
 * CIPC company verification via dedicated /api/external/cipc endpoint.
 * Provide exactly one of: registration_number | vat_number | sole_prop_id_number
 * Docs: reportType "cipc_company_match"
 */
export async function callVerifyNowCipcCompany(params: {
  registrationNumber?: string;
  vatNumber?: string;
  solePropIdNumber?: string;
  mode?: VerifyNowMode;
}): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; error?: string }> {
  const mode = resolveMode(params.mode);
  const registration_number = String(params.registrationNumber || '')
    .trim()
    .toUpperCase();
  const vat_number = String(params.vatNumber || '').replace(/\s/g, '');
  const sole_prop_id_number = String(params.solePropIdNumber || '').replace(/\s/g, '');

  if (!registration_number && !vat_number && !sole_prop_id_number) {
    return {
      ok: false,
      status: 400,
      data: {},
      error: 'Provide registration_number, vat_number, or sole_prop_id_number',
    };
  }

  const body: Record<string, unknown> = {
    reportType: 'cipc_company_match',
    mode,
  };
  // Prefer registration_number → vat_number → sole_prop_id_number (API priority)
  if (registration_number) body.registration_number = registration_number;
  else if (vat_number) body.vat_number = vat_number;
  else body.sole_prop_id_number = sole_prop_id_number;

  return postVerifyNow('/cipc', body);
}

export type BankAccountType =
  | 'Savings'
  | 'Current'
  | 'Cheque'
  | 'Transmission'
  | 'Bond'
  | 'Credit'
  | string;

export type BankVerificationIdentityType =
  | 'IDNumber'
  | 'PassportNumber'
  | 'CompanyRegNumber'
  | string;

export type BankAccountVerificationResult = {
  ok: boolean;
  statusText: string;
  summary: string;
  identityAndAccountVerified: boolean;
  accountFound: string;
  accountOpen: string;
  identityMatch: string;
  accountTypeMatch: string;
  acceptsCredits: string;
  acceptsDebits: string;
  lengthOpen: string;
  bankReference: string;
  bankResponseTimestamp: string;
  requestId: string;
  remainingCredits: number | null;
  mode: string;
};

function yesNo(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (/^(yes|true|y|1)$/i.test(s)) return 'Yes';
  if (/^(no|false|n|0)$/i.test(s)) return 'No';
  return s;
}

/**
 * Parse VerifyNow bank-account-verification response.
 * Docs: POST /api/external/bank-account-verification
 */
export function parseVerifyNowBankResult(
  result: Record<string, unknown>
): BankAccountVerificationResult {
  const results = (result.results || {}) as Record<string, unknown>;
  const vr =
    (results.verification_results as Record<string, unknown>) ||
    (results.VerificationResults as Record<string, unknown>) ||
    (results as Record<string, unknown>);

  const identityAndAccountVerified =
    results.identity_and_account_verified === true ||
    results.identityAndAccountVerified === true ||
    (/yes|true/i.test(String(vr.identityMatch || vr.IdentityMatch || '')) &&
      /yes|true/i.test(String(vr.accountFound || vr.AccountFound || '')));

  const summary = String(
    results.summary || results.Summary || vr.Status || vr.status || result.status || ''
  ).trim();

  const statusText =
    String(vr.Status || vr.status || summary || '').trim() ||
    (identityAndAccountVerified ? 'Verified' : 'Unknown');

  const successFlag =
    result.success === true ||
    identityAndAccountVerified ||
    /verified|success|verifiednoerrors/i.test(statusText);

  const failed =
    result.success === false ||
    /invalid|failed|error|not found|rejected|no match/i.test(statusText) ||
    /no/i.test(String(vr.accountFound || '')) ||
    /no/i.test(String(vr.identityMatch || ''));

  const remaining =
    result.remaining_credits != null
      ? Number(result.remaining_credits)
      : result.remainingCredits != null
        ? Number(result.remainingCredits)
        : null;

  return {
    ok: successFlag && !failed,
    statusText,
    summary:
      summary ||
      (successFlag && !failed ? 'Identity and Bank Account Verified' : statusText),
    identityAndAccountVerified: Boolean(identityAndAccountVerified && !failed),
    accountFound: yesNo(vr.accountFound ?? vr.AccountFound),
    accountOpen: yesNo(vr.accountOpen ?? vr.AccountOpen),
    identityMatch: yesNo(vr.identityMatch ?? vr.IdentityMatch),
    accountTypeMatch: yesNo(vr.accountTypeMatch ?? vr.AccountTypeMatch),
    acceptsCredits: yesNo(vr.acceptsCredits ?? vr.AcceptsCredits),
    acceptsDebits: yesNo(vr.acceptsDebits ?? vr.AcceptsDebits),
    lengthOpen: yesNo(vr.lengthOpen ?? vr.LengthOpen),
    bankReference: String(vr.bankReference || vr.BankReference || '').trim(),
    bankResponseTimestamp: String(
      vr.bankResponseTimestamp || vr.BankResponseTimestamp || ''
    ).trim(),
    requestId: String(result.requestId || result.request_id || ''),
    remainingCredits: Number.isFinite(remaining as number) ? (remaining as number) : null,
    mode: String(result.mode || ''),
  };
}

/**
 * Bank account ownership verification (AVS).
 * Individual: firstName + surname + IDNumber
 * Company: type "Company", surname = company name, identityType CompanyRegNumber
 * Docs: https://www.verifynow.co.za/api-docs — POST /api/external/bank-account-verification
 */
export async function callVerifyNowBankAccount(params: {
  type?: 'Individual' | 'Company';
  firstName?: string;
  surname: string;
  identityNumber: string;
  identityType: BankVerificationIdentityType;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankName?: string;
  bankAccountType: BankAccountType;
  mode?: VerifyNowMode;
}): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; error?: string }> {
  const mode = resolveMode(params.mode);
  const bankAccountNumber = String(params.bankAccountNumber || '').replace(/\s/g, '');
  const bankBranchCode = String(params.bankBranchCode || '').replace(/\s/g, '');
  const identityNumber = String(params.identityNumber || '').trim();
  const surname = String(params.surname || '').trim();
  const bankAccountType = String(params.bankAccountType || '').trim();

  if (!surname) {
    return { ok: false, status: 400, data: {}, error: 'Account holder surname / company name is required' };
  }
  if (!identityNumber) {
    return { ok: false, status: 400, data: {}, error: 'Identity number (ID or company registration) is required' };
  }
  if (!bankAccountNumber || bankAccountNumber.length < 7 || bankAccountNumber.length > 16) {
    return {
      ok: false,
      status: 400,
      data: {},
      error: 'Bank account number must be 7–16 digits',
    };
  }
  if (!/^\d{6}$/.test(bankBranchCode)) {
    return {
      ok: false,
      status: 400,
      data: {},
      error: 'Branch code must be a 6-digit SA bank branch code',
    };
  }
  if (!bankAccountType) {
    return { ok: false, status: 400, data: {}, error: 'Bank account type is required (e.g. Current, Savings)' };
  }

  const body: Record<string, unknown> = {
    type: params.type || 'Individual',
    surname,
    identityNumber,
    identityType: params.identityType || 'IDNumber',
    bankAccountNumber,
    bankBranchCode,
    bankAccountType,
    mode,
  };

  const firstName = String(params.firstName || '').trim();
  if (firstName) body.firstName = firstName;
  const bankName = String(params.bankName || '').trim();
  if (bankName) body.bankName = bankName;

  return postVerifyNow('/bank-account-verification', body);
}
