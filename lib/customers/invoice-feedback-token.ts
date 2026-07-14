/**
 * Public tokens for invoice feedback links (rate / claim / RIAD).
 * Not cryptographic secrets — validate invoice exists server-side.
 *
 * Preferred format (path-safe, no base64 ambiguity):
 *   v1_{companyId}_{invoiceId}
 *
 * Legacy (still accepted):
 *   base64url("inv:{companyId}:{invoiceId}:{invoiceNumber}")
 */

export function buildInvoiceFeedbackToken(opts: {
  companyId: number;
  invoiceId: number;
  invoiceNumber?: string | null;
}): string {
  const companyId = Math.floor(Number(opts.companyId));
  const invoiceId = Math.floor(Number(opts.invoiceId));
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new Error('buildInvoiceFeedbackToken: valid companyId required');
  }
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    throw new Error('buildInvoiceFeedbackToken: valid invoiceId required');
  }
  // Path-safe: only [A-Za-z0-9_]. Optional short slug from invoice number for readability.
  const slug = String(opts.invoiceNumber || '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 24);
  return slug
    ? `v1_${companyId}_${invoiceId}_${slug}`
    : `v1_${companyId}_${invoiceId}`;
}

/** Normalize tokens from path params / query / copy-paste. */
export function normalizeFeedbackToken(raw: unknown): string {
  let t = String(raw ?? '').trim();
  if (!t) return '';
  // Accidental full URL pasted
  const pathMatch = t.match(/\/i\/([^/?#]+)/i);
  if (pathMatch?.[1]) t = pathMatch[1];
  // Drop query/hash if they snuck into the segment
  t = t.split('?')[0].split('#')[0];
  // Decode up to twice (double-encoding from some PDF / mail clients)
  for (let i = 0; i < 2; i++) {
    try {
      const d = decodeURIComponent(t);
      if (d === t) break;
      t = d;
    } catch {
      break;
    }
  }
  // Spaces from + mishandling
  t = t.replace(/\s+/g, '+');
  return t.trim();
}

export function parseInvoiceFeedbackToken(
  token: string
): { companyId: number; invoiceId: number; invoiceNumber: string } | null {
  const t = normalizeFeedbackToken(token);
  if (!t) return null;

  // v1_{companyId}_{invoiceId}[_{optionalSlug}]
  const v1 = /^v1_(\d+)_(\d+)(?:_([A-Za-z0-9]+))?$/.exec(t);
  if (v1) {
    return {
      companyId: Number(v1[1]),
      invoiceId: Number(v1[2]),
      invoiceNumber: v1[3] || '',
    };
  }

  // Legacy base64url: inv:companyId:invoiceId:invoiceNumber
  try {
    let b64 = t.replace(/-/g, '+').replace(/_/g, '/');
    // restore padding
    const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
    if (pad) b64 += '='.repeat(pad);
    const raw = Buffer.from(b64, 'base64').toString('utf8').replace(/\0/g, '').trim();
    const m = /^inv:(\d+):(\d+):(.*)$/s.exec(raw);
    if (!m) return null;
    return {
      companyId: Number(m[1]),
      invoiceId: Number(m[2]),
      invoiceNumber: m[3] || '',
    };
  } catch {
    return null;
  }
}

export function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://www.supplieradvisor.com';
  return String(raw).replace(/\/$/, '');
}

export function invoiceFeedbackUrl(token: string): string {
  // Token is path-safe (v1_…) — avoid over-encoding so links stay clean
  const safe = encodeURIComponent(token).replace(/%5F/gi, '_');
  return `${appBaseUrl()}/i/${safe}`;
}

/** QR image via public encoder (no extra npm dep). */
export function qrImageUrl(data: string, size = 140): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}
