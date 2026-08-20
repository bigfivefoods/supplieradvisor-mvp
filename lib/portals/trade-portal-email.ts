import { getResend, getResendFrom, getAppUrl } from '@/lib/resend';
import { renderClientEmailLayout } from '@/lib/services/advisor-branded-email';
import type { TradePortalKind } from '@/lib/portals/trade-portal';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendTradePortalAccessEmail(opts: {
  to: string;
  guestName: string;
  hostName: string;
  kind: TradePortalKind;
  portalUrl: string;
  logoUrl?: string | null;
}): Promise<{ sent: boolean; warning?: string }> {
  const to = String(opts.to || '')
    .toLowerCase()
    .trim();
  if (!to.includes('@')) {
    return { sent: false, warning: 'No email on this person' };
  }
  try {
    const resend = getResend();
    const kindLabel = opts.kind === 'customer' ? 'customer' : 'supplier';
    const guest = escapeHtml(opts.guestName);
    const host = escapeHtml(opts.hostName);
    const url = String(opts.portalUrl);
    const urlAttr = escapeHtml(url);
    const html = renderClientEmailLayout({
      brand: opts.hostName,
      logoUrl: opts.logoUrl,
      headline: `Your ${kindLabel} portal`,
      leadHtml: `Hello ${guest} — <strong>${host}</strong> opened a private portal for you on SupplierAdvisor. Quotes, orders, and documents without creating an account. Open the link on your phone or laptop; join when you are ready to trade live.`,
      extraHtml: `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:16px 18px;margin:20px 0 8px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0369a1;">Your portal</p>
        <p style="margin:0;font-size:13px;line-height:1.55;word-break:break-all;">
          <a href="${urlAttr}" style="color:#0077b6;font-weight:600;">${urlAttr}</a>
        </p>
      </div>`,
      ctaLabel: 'Open portal',
      ctaUrl: url,
      footerNote: `${getAppUrl().replace(/^https?:\/\//, '')} · You can join anytime to quote, pay, and build trust.`,
    });
    await resend.emails.send({
      from: getResendFrom(),
      to,
      subject: `${opts.hostName} shared a ${kindLabel} portal with you`,
      html,
    });
    return { sent: true };
  } catch (e) {
    return {
      sent: false,
      warning: e instanceof Error ? e.message : 'Email not sent',
    };
  }
}
