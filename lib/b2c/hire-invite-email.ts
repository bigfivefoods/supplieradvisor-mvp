import { escapeHtml } from '@/lib/b2c/html-escape';

export function hireCustomerInviteEmailHtml(opts: {
  customerName?: string | null;
  brand: string;
  appLink: string;
  portalLink: string;
}): string {
  const name = opts.customerName ? escapeHtml(opts.customerName) : null;
  const brand = escapeHtml(opts.brand);
  const app = escapeHtml(opts.appLink);
  const portal = escapeHtml(opts.portalLink);
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#0891b2,#0e7490);padding:36px 40px;color:#fff;">
      <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;">SA Member · HireAdvisor®</div>
      <h1 style="margin:8px 0 0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Your hire app is ready</h1>
    </div>
    <div style="padding:32px 40px;color:#334155;font-size:16px;line-height:1.65;">
      <p>Hello${name ? ` ${name}` : ''},</p>
      <p><strong>${brand}</strong> set up your personal hire portal. Open <strong>SA Member</strong> on your phone to browse gear, request dates, complete documents and track hires.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${app}" style="background:#0891b2;color:#fff;padding:16px 36px;border-radius:9999px;text-decoration:none;font-weight:800;display:inline-block;">Open SA Member</a>
      </div>
      <p style="font-size:13px;color:#64748b;">Log in with this email. The brand is added automatically.</p>
      <p style="font-size:13px;word-break:break-all;"><a href="${app}" style="color:#0e7490;">${app}</a></p>
      <p style="font-size:12px;color:#94a3b8;">Direct portal (no app): <a href="${portal}" style="color:#64748b;">${portal}</a></p>
    </div>
  </div>
</body>
</html>`;
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
