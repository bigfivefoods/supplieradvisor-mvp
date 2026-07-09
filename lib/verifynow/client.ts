/** VerifyNow SA ID helpers — https://www.verifynow.co.za */

export type VerifyNowMode = 'sandbox' | 'production';

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

export async function callVerifyNowSaid(params: {
  idNumber: string;
  mode?: VerifyNowMode;
  reportType?: 'said_verification' | 'consumer_trace';
}): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; error?: string }> {
  const apiKey = process.env.VERIFYNOW_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      data: {},
      error: 'VERIFYNOW_API_KEY is not configured on the server',
    };
  }

  const mode =
    params.mode ||
    ((process.env.VERIFYNOW_MODE as VerifyNowMode) || 'production');

  const reportType = params.reportType || 'said_verification';

  try {
    const response = await fetch('https://www.verifynow.co.za/api/external/verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        reportType,
        idNumber: params.idNumber.replace(/\s/g, ''),
        mode,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error:
          String(data.error || data.message || `VerifyNow HTTP ${response.status}`) ||
          'VerifyNow request failed',
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
