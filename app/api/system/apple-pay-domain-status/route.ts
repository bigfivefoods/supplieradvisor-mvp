/**
 * Ops diagnostic: Apple Pay domain association hosting + Paystack registration.
 * GET /api/system/apple-pay-domain-status
 * Optional: ?register=1 to attempt domain registration (requires PAYSTACK_SECRET_KEY).
 */
import { NextRequest, NextResponse } from 'next/server';
import { APPLE_PAY_DOMAIN_ASSOCIATION_BODY } from '@/lib/billing/apple-pay-domain-association';
import { getPaystackSecretKey } from '@/lib/billing/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOMAINS = ['www.supplieradvisor.com', 'supplieradvisor.com'] as const;

function parseBrokerCertExpiry(body: string): {
  notAfter?: string;
  expired?: boolean;
  daysUntilExpiry?: number | null;
  note: string;
} {
  try {
    const j = JSON.parse(body) as { signature?: string };
    const sig = String(j.signature || '');
    // DER UTCTime 170dYYMMDDHHMMSSZ — broker leaf notAfter is second pair for this payload
    const matches = [...sig.matchAll(/170d([0-9]{12})Z/g)].map((m) => m[1]);
    // Typical order: notBefore, notAfter for first cert, then more…
    // Prefer dates starting with 24 (2024) or later as notAfter candidates
    const candidates = matches
      .map((t) => {
        const yy = Number(t.slice(0, 2));
        const year = yy >= 70 ? 1900 + yy : 2000 + yy;
        const month = Number(t.slice(2, 4));
        const day = Number(t.slice(4, 6));
        const hour = Number(t.slice(6, 8));
        const min = Number(t.slice(8, 10));
        const sec = Number(t.slice(10, 12));
        return new Date(Date.UTC(year, month - 1, day, hour, min, sec));
      })
      .filter((d) => Number.isFinite(d.getTime()));
    // Broker intermediate notAfter for current Paystack file is 2024-05-16
    const notAfter =
      candidates.find((d) => d.getUTCFullYear() === 2024) ||
      candidates.sort((a, b) => a.getTime() - b.getTime())[1] ||
      candidates[0];
    if (!notAfter) {
      return { note: 'Could not parse UTCTime from signature' };
    }
    const now = Date.now();
    const expired = notAfter.getTime() < now;
    const daysUntilExpiry = Math.round(
      (notAfter.getTime() - now) / (24 * 3600 * 1000)
    );
    return {
      notAfter: notAfter.toISOString(),
      expired,
      daysUntilExpiry,
      note: expired
        ? 'Broker cert in association file is EXPIRED — Apple rejects domain registration until Paystack issues a renewed file'
        : 'Broker cert notAfter is still in the future',
    };
  } catch (e) {
    return {
      note: e instanceof Error ? e.message : 'parse error',
    };
  }
}

async function probeHosted(domain: string) {
  const url = `https://${domain}/.well-known/apple-developer-merchantid-domain-association`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/text,*/*' },
    });
    const text = await res.text();
    return {
      url,
      status: res.status,
      contentType: res.headers.get('content-type'),
      bytes: text.length,
      startsOk: text.startsWith('{"pspId"'),
      matchesLocal:
        text === APPLE_PAY_DOMAIN_ASSOCIATION_BODY ||
        text.trim() === APPLE_PAY_DOMAIN_ASSOCIATION_BODY.trim(),
    };
  } catch (e) {
    return {
      url,
      error: e instanceof Error ? e.message : 'fetch failed',
    };
  }
}

export async function GET(request: NextRequest) {
  const secret = getPaystackSecretKey();
  const wantRegister =
    request.nextUrl.searchParams.get('register') === '1' ||
    request.nextUrl.searchParams.get('register') === 'true';
  // Register attempts need ops secret (or local/dev)
  const opsSecret =
    process.env.CRON_SECRET ||
    process.env.PLATFORM_OPS_SECRET ||
    process.env.REFERRAL_OPS_SECRET ||
    '';
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  const opsOk =
    !opsSecret ||
    provided === opsSecret ||
    process.env.NODE_ENV !== 'production';

  const cert = parseBrokerCertExpiry(APPLE_PAY_DOMAIN_ASSOCIATION_BODY);
  const hosted = await Promise.all(DOMAINS.map((d) => probeHosted(d)));

  let registered: string[] = [];
  let listError: string | null = null;
  if (secret && opsOk) {
    try {
      const res = await fetch('https://api.paystack.co/apple-pay/domain', {
        headers: { Authorization: `Bearer ${secret}` },
        cache: 'no-store',
      });
      const j = (await res.json()) as {
        status?: boolean;
        message?: string;
        data?: { domainNames?: string[] };
      };
      if (j.status) registered = j.data?.domainNames || [];
      else listError = j.message || 'list failed';
    } catch (e) {
      listError = e instanceof Error ? e.message : 'list error';
    }
  } else if (secret && !opsOk) {
    listError = 'Paystack list omitted — send x-cron-secret for live registration list';
  }

  const registerResults: Array<Record<string, unknown>> = [];
  if (wantRegister) {
    if (!opsOk) {
      registerResults.push({
        error: 'register requires Authorization: Bearer <CRON_SECRET> or x-cron-secret',
      });
    } else if (!secret) {
      registerResults.push({ error: 'PAYSTACK_SECRET_KEY not configured' });
    } else {
      for (const domainName of DOMAINS) {
        try {
          const res = await fetch('https://api.paystack.co/apple-pay/domain', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${secret}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domainName }),
          });
          const j = await res.json();
          registerResults.push({ domainName, http: res.status, ...j });
        } catch (e) {
          registerResults.push({
            domainName,
            error: e instanceof Error ? e.message : 'register error',
          });
        }
      }
      // refresh list
      try {
        const res = await fetch('https://api.paystack.co/apple-pay/domain', {
          headers: { Authorization: `Bearer ${secret}` },
          cache: 'no-store',
        });
        const j = (await res.json()) as {
          status?: boolean;
          data?: { domainNames?: string[] };
        };
        if (j.status) registered = j.data?.domainNames || [];
      } catch {
        /* soft */
      }
    }
  }

  const hostingOk = hosted.every(
    (h) =>
      'status' in h &&
      h.status === 200 &&
      String(h.contentType || '').includes('application/text') &&
      h.bytes === 4559
  );

  return NextResponse.json({
    ok: hostingOk,
    hostingOk,
    cert,
    hosted,
    paystack: {
      secretConfigured: Boolean(secret),
      registeredDomains: registered,
      listError,
      registerAttempted: wantRegister,
      registerResults: wantRegister ? registerResults : undefined,
    },
    webhook: {
      canonical: 'https://www.supplieradvisor.com/api/paystack/webhook',
      alias: 'https://www.supplieradvisor.com/api/billing/webhook',
    },
    nextSteps: cert.expired
      ? [
          'Hosting is correct (200 + application/text + 4559 bytes).',
          'Open a Paystack Support ticket: association signature uses ecc-smp-broker-sign_UC4-PROD notAfter 2024-05-16 (expired). Request a renewed domain association file.',
          'After Paystack sends a new file, replace lib/billing/apple-pay-domain-association.ts + public/.well-known copy, redeploy, then ?register=1 or Verify Domain in dashboard.',
          'Enable Apple Pay under Paystack Preferences (accept terms).',
          'Configure webhook to /api/paystack/webhook or /api/billing/webhook.',
        ]
      : [
          'If domains empty: Dashboard → Settings → Apple Pay → Verify Domain, or GET this route with ?register=1',
          'Enable Apple Pay under Preferences if not already.',
        ],
  });
}
