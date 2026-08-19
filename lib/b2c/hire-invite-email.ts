import { escapeHtml } from '@/lib/b2c/html-escape';
import { renderAdvisorNoticeEmail } from '@/lib/services/advisor-branded-email';

export function hireCustomerInviteEmailHtml(opts: {
  customerName?: string | null;
  brand: string;
  appLink: string;
  portalLink: string;
  logoUrl?: string | null;
}): string {
  const name = opts.customerName ? escapeHtml(opts.customerName) : '';
  const brand = escapeHtml(opts.brand);
  const portal = escapeHtml(opts.portalLink);
  return renderAdvisorNoticeEmail({
    personName: opts.customerName,
    brand: opts.brand,
    logoUrl: opts.logoUrl,
    moduleKey: 'hiregraph',
    subject: `${opts.brand} · your hire app is ready`,
    headline: 'Your hire app is ready',
    leadHtml: `Hello${name ? ` ${name}` : ''}, <strong>${brand}</strong> set up your personal hire portal. Open <strong>SA Member</strong> on your phone to browse gear, request dates, complete documents and track hires.`,
    extraHtml: `<p style="margin:16px 0 0;font-size:12px;color:#64748b;word-break:break-all;">Direct portal: <a href="${portal}" style="color:#0e7490;">${portal}</a></p>`,
    ctaUrl: opts.appLink,
    ctaLabel: 'Open SA Member',
  }).html;
}

export function hireCustomerInviteEmailText(opts: {
  customerName?: string | null;
  brand: string;
  appLink: string;
  portalLink: string;
}): string {
  const name = opts.customerName ? ` ${opts.customerName}` : '';
  return [
    `Hello${name},`,
    '',
    `${opts.brand} invited you to SA Member — hire gear, complete docs and track bookings on your phone.`,
    '',
    `Open the app: ${opts.appLink}`,
    '',
    `Or open the portal directly: ${opts.portalLink}`,
    '',
    '— HireAdvisor® · SA Member',
  ].join('\n');
}
