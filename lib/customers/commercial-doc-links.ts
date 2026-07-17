/**
 * Public URLs + QR helpers for commercial documents (quote / invoice).
 */
import {
  appBaseUrl,
  buildInvoiceFeedbackToken,
  invoiceFeedbackUrl,
  qrImageUrl,
} from '@/lib/customers/invoice-feedback-token';

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

/** Public company directory profile — rate / connect / trust. */
export function rateSellerPublicUrl(companyId: number): string {
  const id = Math.floor(Number(companyId));
  if (!Number.isFinite(id) || id <= 0) {
    return `${appBaseUrl()}/`;
  }
  return `${appBaseUrl()}/c/${id}?from=quote`;
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
