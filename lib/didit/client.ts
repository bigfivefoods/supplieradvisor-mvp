/**
 * Didit identity verification (international KYC).
 * Docs: https://docs.didit.me — Sessions API v3
 *
 * Env:
 *   DIDIT_API_KEY          — application API key (required)
 *   DIDIT_WORKFLOW_ID      — KYC workflow UUID (required for session create)
 *   DIDIT_WEBHOOK_SECRET   — optional HMAC secret for webhook verification
 *   DIDIT_BASE_URL         — override API base (default verification.didit.me)
 */

const DEFAULT_BASE = 'https://verification.didit.me';

export function diditConfigured(): boolean {
  return Boolean(
    process.env.DIDIT_API_KEY?.trim() && process.env.DIDIT_WORKFLOW_ID?.trim()
  );
}

function apiKey(): string | null {
  const k = process.env.DIDIT_API_KEY?.trim();
  return k || null;
}

function baseUrl(): string {
  return (process.env.DIDIT_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
}

function workflowId(): string | null {
  return process.env.DIDIT_WORKFLOW_ID?.trim() || null;
}

export type DiditCreateSessionResult =
  | {
      ok: true;
      session_id: string;
      url: string;
      session_token: string;
      status: string;
      vendor_data?: string | null;
      raw: Record<string, unknown>;
    }
  | { ok: false; status: number; error: string; raw?: Record<string, unknown> };

export async function createDiditSession(params: {
  vendorData: string;
  callbackUrl: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, unknown>;
  language?: string;
}): Promise<DiditCreateSessionResult> {
  const key = apiKey();
  const wf = workflowId();
  if (!key || !wf) {
    return {
      ok: false,
      status: 503,
      error:
        'Didit is not configured (set DIDIT_API_KEY and DIDIT_WORKFLOW_ID)',
    };
  }

  const body: Record<string, unknown> = {
    workflow_id: wf,
    vendor_data: params.vendorData,
    callback: params.callbackUrl,
    callback_method: 'both',
    metadata: params.metadata || {},
  };
  if (params.language) body.language = params.language;
  if (params.email || params.phone) {
    body.contact_details = {
      ...(params.email ? { email: params.email } : {}),
      ...(params.phone ? { phone: params.phone } : {}),
      send_notification_emails: false,
    };
  }
  if (params.firstName || params.lastName) {
    body.expected_details = {
      ...(params.firstName ? { first_name: params.firstName } : {}),
      ...(params.lastName ? { last_name: params.lastName } : {}),
    };
  }

  try {
    const res = await fetch(`${baseUrl()}/v3/session/`, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      const err =
        String(
          data.detail ||
            (data.workflow_id as string) ||
            JSON.stringify(data)
        ) || `Didit HTTP ${res.status}`;
      return { ok: false, status: res.status, error: err, raw: data };
    }
    const sessionId = String(data.session_id || '');
    const url = String(data.url || data.verification_url || '');
    if (!sessionId || !url) {
      return {
        ok: false,
        status: 502,
        error: 'Didit response missing session_id or url',
        raw: data,
      };
    }
    return {
      ok: true,
      session_id: sessionId,
      url,
      session_token: String(data.session_token || ''),
      status: String(data.status || 'Not Started'),
      vendor_data: data.vendor_data ? String(data.vendor_data) : null,
      raw: data,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : 'Didit network error',
    };
  }
}

export type DiditDecisionResult =
  | {
      ok: true;
      status: string;
      decision?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      dob?: string;
      documentNumber?: string;
      nationality?: string;
      raw: Record<string, unknown>;
    }
  | { ok: false; status: number; error: string; raw?: Record<string, unknown> };

/**
 * Retrieve session decision / status.
 * GET /v3/session/{id}/decision/  (falls back to session detail)
 */
export async function retrieveDiditDecision(
  sessionId: string
): Promise<DiditDecisionResult> {
  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      status: 503,
      error: 'DIDIT_API_KEY is not configured',
    };
  }
  const id = String(sessionId || '').trim();
  if (!id) {
    return { ok: false, status: 400, error: 'session_id required' };
  }

  try {
    let res = await fetch(`${baseUrl()}/v3/session/${encodeURIComponent(id)}/decision/`, {
      method: 'GET',
      headers: { 'x-api-key': key },
    });
    if (res.status === 404) {
      res = await fetch(`${baseUrl()}/v3/session/${encodeURIComponent(id)}/`, {
        method: 'GET',
        headers: { 'x-api-key': key },
      });
    }
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: String(data.detail || `Didit HTTP ${res.status}`),
        raw: data,
      };
    }

    // Decision payloads vary — normalize common shapes
    const idv =
      (data.id_verification as Record<string, unknown>) ||
      (data.id_verifications as unknown[])?.[0] ||
      ((data.decision as Record<string, unknown>)?.id_verification as Record<
        string,
        unknown
      >) ||
      {};
    const idvObj = Array.isArray(idv)
      ? ((idv[0] as Record<string, unknown>) || {})
      : (idv as Record<string, unknown>);

    const status = String(
      data.status ||
        data.decision ||
        idvObj.status ||
        (data as { session?: { status?: string } }).session?.status ||
        ''
    );
    const firstName = String(
      idvObj.first_name || idvObj.firstName || data.first_name || ''
    ).trim();
    const lastName = String(
      idvObj.last_name || idvObj.lastName || data.last_name || ''
    ).trim();
    const dob = String(
      idvObj.date_of_birth || idvObj.dob || data.date_of_birth || ''
    ).trim();
    const documentNumber = String(
      idvObj.document_number ||
        idvObj.personal_number ||
        idvObj.identification_number ||
        ''
    ).trim();
    const nationality = String(
      idvObj.nationality || idvObj.issuing_state || ''
    ).trim();

    return {
      ok: true,
      status,
      decision: String(data.decision || status),
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || undefined,
      dob: dob || undefined,
      documentNumber: documentNumber || undefined,
      nationality: nationality || undefined,
      raw: data,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : 'Didit network error',
    };
  }
}

/** Map Didit session status → our IdentityStatus */
export function mapDiditStatus(status: string): {
  identityStatus: import('@/lib/identity/person-verification').IdentityStatus;
  statusText: string;
} {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s.includes('approved')) {
    return { identityStatus: 'verified', statusText: status };
  }
  if (s === 'declined' || s.includes('declined') || s.includes('rejected')) {
    return { identityStatus: 'failed', statusText: status };
  }
  if (s.includes('review')) {
    return { identityStatus: 'in_review', statusText: status };
  }
  if (
    s.includes('progress') ||
    s.includes('not started') ||
    s.includes('awaiting') ||
    s.includes('resubmit')
  ) {
    return { identityStatus: 'pending', statusText: status };
  }
  if (s.includes('expir') || s.includes('abandon')) {
    return { identityStatus: 'failed', statusText: status };
  }
  return { identityStatus: 'pending', statusText: status || 'Pending' };
}

/**
 * Verify Didit webhook signature (HMAC-SHA256) when DIDIT_WEBHOOK_SECRET is set.
 * Header is typically `X-Signature-Simple` or `X-Signature` depending on console config.
 */
export async function verifyDiditWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return (
      process.env.NODE_ENV !== 'production' &&
      process.env.VERCEL_ENV !== 'production'
    );
  }
  if (!signatureHeader) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const expected = signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase();
    return hex === expected || hex === signatureHeader.trim().toLowerCase();
  } catch {
    return false;
  }
}
