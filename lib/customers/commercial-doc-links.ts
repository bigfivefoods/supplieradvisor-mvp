/**
 * Public URLs + QR helpers for commercial documents (quote / invoice).
 */
import {
  appBaseUrl,
  buildInvoiceFeedbackToken,
  invoiceFeedbackUrl,
  qrImageUrl,
} from '@/lib/customers/invoice-feedback-token';

/** Resolve profile logo to absolute URL for fetch / HTML / PDF. */
export function absoluteLogoUrl(url: string | null | undefined): string | null {
  const u = String(url || '').trim();
  if (!u) return null;
  if (
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('data:')
  ) {
    return u;
  }
  if (u.startsWith('//')) return `https:${u}`;
  const base = appBaseUrl();
  return u.startsWith('/') ? `${base}${u}` : `${base}/${u}`;
}

export function registerBusinessUrl(opts?: {
  referrerProfileId?: number | null;
}): string {
  const base = `${appBaseUrl()}/onboarding?type=business`;
  const ref = Number(opts?.referrerProfileId);
  if (Number.isFinite(ref) && ref > 0) {
    return `${base}&ref=${ref}`;
  }
  return base;
}

/**
 * Public rate form for a company (quotation QR).
 * Uses /r/[id] — always works without discovery eligibility or login.
 * ( /c/[id] can 404 if the profile is incomplete / not discoverable. )
 */
export function rateSellerPublicUrl(companyId: number): string {
  const id = Math.floor(Number(companyId));
  if (!Number.isFinite(id) || id <= 0) {
    return `${appBaseUrl()}/`;
  }
  return `${appBaseUrl()}/r/${id}?src=quote`;
}

export function invoiceRateClaimUrls(opts: {
  companyId: number;
  documentId: number;
  number?: string | null;
}): { rateUrl: string; claimUrl: string } | null {
  try {
    const token = buildInvoiceFeedbackToken({
      companyId: opts.companyId,
      invoiceId: opts.documentId,
      invoiceNumber: opts.number,
    });
    const base = invoiceFeedbackUrl(token);
    return {
      rateUrl: `${base}?tab=rate`,
      claimUrl: `${base}?tab=claim`,
    };
  } catch {
    return null;
  }
}

export function qrPngUrl(targetUrl: string, size = 112): string {
  return qrImageUrl(targetUrl, size);
}

/** Fetch QR PNG bytes for embedding in pdfkit. Soft-fails to null. */
export async function fetchQrPngBuffer(
  targetUrl: string,
  size = 112
): Promise<Buffer | null> {
  try {
    const src = qrPngUrl(targetUrl, size);
    const res = await fetch(src, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'image/png' },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (!ab.byteLength) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}
