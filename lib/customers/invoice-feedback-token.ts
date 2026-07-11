/**
 * Opaque public tokens for invoice feedback links (rate / claim / RIAD).
 * Not cryptographic secrets — validate invoice exists server-side.
 */
export function buildInvoiceFeedbackToken(opts: {
  companyId: number;
  invoiceId: number;
  invoiceNumber?: string | null;
}): string {
  const payload = `inv:${opts.companyId}:${opts.invoiceId}:${opts.invoiceNumber || ''}`;
  return Buffer.from(payload, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function parseInvoiceFeedbackToken(
  token: string
): { companyId: number; invoiceId: number; invoiceNumber: string } | null {
  try {
    const pad = token.length % 4 === 0 ? '' : '='.repeat(4 - (token.length % 4));
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const raw = Buffer.from(b64, 'base64').toString('utf8');
    const m = /^inv:(\d+):(\d+):(.*)$/.exec(raw);
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
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

export function invoiceFeedbackUrl(token: string): string {
  return `${appBaseUrl()}/i/${encodeURIComponent(token)}`;
}

/** QR image via public encoder (no extra npm dep). */
export function qrImageUrl(data: string, size = 140): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}
