import { getAppUrl } from '@/lib/resend';

export function businessInviteEmailHtml(params: {
  inviteeName?: string | null;
  businessName: string;
  invitedBy: string;
  inviteLink: string;
  roleLabel?: string;
}) {
  const { inviteeName, businessName, invitedBy, inviteLink, roleLabel } = params;
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#00b4d8 0%,#0077b6 100%);padding:36px 40px;color:#fff;text-align:center;">
      <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;margin-bottom:8px;">SupplierAdvisor®</div>
      <h1 style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">You're invited</h1>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 18px;">
        Hello${inviteeName ? ` ${inviteeName}` : ''},
      </p>
      <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 18px;">
        <strong>${invitedBy}</strong> has invited
        ${roleLabel ? `you as <strong>${roleLabel}</strong> at` : ''}
        <strong>${businessName}</strong> to join SupplierAdvisor — the verified supply-chain platform.
      </p>
      <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 28px;">
        Click below to create your secure account (email verification, Google, Apple, or wallet) and accept this invitation. The link expires in 14 days.
      </p>
      <div style="text-align:center;margin:28px 0 32px;">
        <a href="${inviteLink}" style="background:#00b4d8;color:#fff;padding:16px 40px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
          Accept invitation →
        </a>
      </div>
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
        If the button doesn't work, paste this link into your browser:<br/>
        <a href="${inviteLink}" style="color:#00b4d8;word-break:break-all;">${inviteLink}</a>
      </p>
    </div>
    <div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
      SupplierAdvisor® · Verified. Transparent. Accelerating humanity.
    </div>
  </div>
</body>
</html>`;
}

export function teamInviteEmailHtml(params: {
  inviteeName?: string | null;
  companyName: string;
  role: string;
  invitedBy?: string | null;
  inviteLink: string;
}) {
  return businessInviteEmailHtml({
    inviteeName: params.inviteeName,
    businessName: params.companyName,
    invitedBy: params.invitedBy || 'Your team',
    inviteLink: params.inviteLink,
    roleLabel: params.role,
  });
}

export function buildBusinessInviteLink(token: string) {
  return `${getAppUrl()}/onboarding?invite=${encodeURIComponent(token)}`;
}

export function buildTeamInviteLink(token: string) {
  return `${getAppUrl()}/onboarding/team?invite=${encodeURIComponent(token)}`;
}
