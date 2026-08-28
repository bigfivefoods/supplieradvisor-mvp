/**
 * Shared Apple Pay / Paystack domain checks.
 * Domain registration is platform-wide (supplieradvisor.com), not per gym.
 */
import { APPLE_PAY_DOMAIN_ASSOCIATION_BODY } from '@/lib/billing/apple-pay-domain-association';
import { getPaystackSecretKey } from '@/lib/billing/paystack';

export const APPLE_PAY_DOMAINS = [
  'www.supplieradvisor.com',
  'supplieradvisor.com',
] as const;

export function decodeAssociationPayload(
  body = APPLE_PAY_DOMAIN_ASSOCIATION_BODY
): string {
  const raw = String(body || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('{')) return raw;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    try {
      return Buffer.from(raw, 'hex').toString('utf8');
    } catch {
      return raw;
    }
  }
  return raw;
}

export function parseBrokerCertExpiry(body = APPLE_PAY_DOMAIN_ASSOCIATION_BODY): {
  notAfter?: string;
  expired?: boolean;
  daysUntilExpiry?: number | null;
  note: string;
} {
  try {
    const decoded = decodeAssociationPayload(body);
    const j = JSON.parse(decoded) as {
      signature?: string;
      version?: number;
      pspId?: string;
    };
    if (!j.signature && j.pspId) {
      return {
        expired: false,
        note: 'Current Paystack association file (JSON, no broker certificate to parse)',
      };
    }
    const sig = String(j.signature || '');
    const matches = [...sig.matchAll(/170d([0-9]{12})Z/g)].map((m) => m[1]);
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
    const notAfter =
      candidates.find((d) => d.getUTCFullYear() === 2024) ||
      candidates.sort((a, b) => a.getTime() - b.getTime())[1] ||
      candidates[0];
    if (!notAfter) {
      return { note: 'Could not parse UTCTime from signature' };
    }
    const expired = notAfter.getTime() < Date.now();
    const daysUntilExpiry = Math.round(
      (notAfter.getTime() - Date.now()) / (24 * 3600 * 1000)
    );
    return {
      notAfter: notAfter.toISOString(),
      expired,
      daysUntilExpiry,
      note: expired
        ? 'Paystack’s Apple broker certificate in the association file is expired. Card still works; Apple Pay needs a renewed file from Paystack Support.'
        : 'Broker certificate is still valid',
    };
  } catch (e) {
    return {
      note: e instanceof Error ? e.message : 'parse error',
    };
  }
}

export async function probeApplePayHosted(domain: string) {
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
      startsOk:
        text.startsWith('{"pspId"') ||
        text.startsWith('{"version"') ||
        text.startsWith('7B22') ||
        text.startsWith('7b22'),
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

export async function listPaystackApplePayDomains(): Promise<{
  registered: string[];
  listError: string | null;
  secretConfigured: boolean;
}> {
  const secret = getPaystackSecretKey();
  if (!secret) {
    return {
      registered: [],
      listError: 'PAYSTACK_SECRET_KEY not configured',
      secretConfigured: false,
    };
  }
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
    if (j.status) {
      return {
        registered: j.data?.domainNames || [],
        listError: null,
        secretConfigured: true,
      };
    }
    return {
      registered: [],
      listError: j.message || 'list failed',
      secretConfigured: true,
    };
  } catch (e) {
    return {
      registered: [],
      listError: e instanceof Error ? e.message : 'list error',
      secretConfigured: true,
    };
  }
}

export async function registerPaystackApplePayDomains(): Promise<
  Array<Record<string, unknown>>
> {
  const secret = getPaystackSecretKey();
  if (!secret) {
    return [{ error: 'PAYSTACK_SECRET_KEY not configured' }];
  }
  const results: Array<Record<string, unknown>> = [];
  for (const domainName of APPLE_PAY_DOMAINS) {
    try {
      const res = await fetch('https://api.paystack.co/apple-pay/domain', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domainName }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      results.push({ domainName, http: res.status, ...j });
    } catch (e) {
      results.push({
        domainName,
        error: e instanceof Error ? e.message : 'register error',
      });
    }
  }
  return results;
}

export async function applePaySetupSnapshot() {
  const { ttlGet, ttlSet } = await import('@/lib/system/memory-ttl');
  const cached = ttlGet<Awaited<ReturnType<typeof snapshotUncached>>>(
    'apple-pay-setup'
  );
  if (cached) return cached;
  const snap = await snapshotUncached();
  ttlSet('apple-pay-setup', snap, 10 * 60 * 1000);
  return snap;
}

async function snapshotUncached() {
  const cert = parseBrokerCertExpiry();
  const hosted = await Promise.all(
    APPLE_PAY_DOMAINS.map((d) => probeApplePayHosted(d))
  );
  const paystack = await listPaystackApplePayDomains();
  const hostingOk = hosted.every(
    (h) =>
      'status' in h &&
      h.status === 200 &&
      String(h.contentType || '').includes('application/text') &&
      (h.bytes === APPLE_PAY_DOMAIN_ASSOCIATION_BODY.length || h.startsOk)
  );
  const registeredOk = APPLE_PAY_DOMAINS.every((d) =>
    paystack.registered.some(
      (r) => r === d || r.endsWith(d) || d.endsWith(r)
    )
  );
  return {
    hostingOk,
    cert,
    hosted,
    paystack: {
      secretConfigured: paystack.secretConfigured,
      registeredDomains: paystack.registered,
      listError: paystack.listError,
    },
    applePayReady: hostingOk && registeredOk,
    nextSteps: registeredOk
      ? [
          'Domain is registered. Enable Apple Pay under Paystack Dashboard → Preferences if the toggle is off.',
          'Apple Pay appears on Safari / iPhone when members pay on https://www.supplieradvisor.com.',
        ]
      : [
          'Host the Paystack hex association file (not decoded JSON), then register www and apex.',
          'Enable Apple Pay under Preferences and accept Apple’s terms.',
        ],
  };
}
