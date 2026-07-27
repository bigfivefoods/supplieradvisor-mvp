/**
 * DBE claim notification + email approval helpers.
 */
import { createHash, randomBytes } from 'crypto';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';

export function generateClaimApprovalToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function claimReviewUrl(opts: {
  origin: string;
  token: string;
  action?: 'approve' | 'reject';
}): string {
  const base = `${opts.origin.replace(/\/$/, '')}/claim-review/${opts.token}`;
  if (opts.action) return `${base}?action=${opts.action}`;
  return base;
}

export type ClaimEmailPack = {
  id: number;
  school_name: string;
  emis?: string | null;
  district?: string | null;
  province?: string | null;
  period_from: string;
  period_to: string;
  meals_served: number;
  days_fed: number;
  claim_amount: number;
  approved_brand_pct?: number | null;
  tariff_zar?: number | null;
};

export async function sendDbeClaimSubmittedEmail(opts: {
  to: string;
  agencyName: string;
  pack: ClaimEmailPack;
  approveUrl: string;
  rejectUrl: string;
  reviewUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const resend = getResend();
    const amount = Number(opts.pack.claim_amount || 0).toLocaleString('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    });
    const subject = `[NSNP claim] ${opts.pack.school_name} — ${opts.pack.period_from} → ${opts.pack.period_to} · ${amount}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#0f172a">
        <h2 style="margin:0 0 8px;color:#0c4a6e">NSNP claim submitted for DBE approval</h2>
        <p style="margin:0 0 16px;color:#334155">
          A school on <strong>${escapeHtml(opts.agencyName)}</strong> has submitted a funding claim pack.
          It cannot be paid until a DBE official approves it.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
          <tr><td style="padding:6px 0;color:#64748b">School</td><td style="padding:6px 0;font-weight:700">${escapeHtml(opts.pack.school_name)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">EMIS / NATEMIS</td><td style="padding:6px 0">${escapeHtml(String(opts.pack.emis || '—'))}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">District</td><td style="padding:6px 0">${escapeHtml([opts.pack.district, opts.pack.province].filter(Boolean).join(', ') || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Period</td><td style="padding:6px 0">${escapeHtml(opts.pack.period_from)} → ${escapeHtml(opts.pack.period_to)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Days fed</td><td style="padding:6px 0">${opts.pack.days_fed}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Meals served</td><td style="padding:6px 0">${Number(opts.pack.meals_served).toLocaleString('en-ZA')}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Approved foods %</td><td style="padding:6px 0">${opts.pack.approved_brand_pct ?? '—'}%</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Claim amount</td><td style="padding:6px 0;font-weight:800;font-size:16px">${amount}</td></tr>
        </table>
        <p style="margin:0 0 12px">
          <a href="${opts.approveUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;margin-right:8px">Approve claim</a>
          <a href="${opts.rejectUrl}" style="display:inline-block;background:#e11d48;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Reject</a>
        </p>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b">
          Or open the full review page (confirm your DBE email):<br/>
          <a href="${opts.reviewUrl}">${opts.reviewUrl}</a>
        </p>
        <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">
          This link expires in 14 days. Only the Department of Basic Education may approve NSNP claims.
          Claim #${opts.pack.id}
        </p>
      </div>
    `;
    await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: opts.to,
      subject,
      html,
    });
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Email send failed',
    };
  }
}

export async function sendClaimDecisionEmail(opts: {
  to: string;
  schoolName: string;
  decision: 'approved' | 'rejected' | 'paid';
  periodFrom: string;
  periodTo: string;
  claimAmount: number;
  reason?: string | null;
  approverEmail?: string | null;
}): Promise<void> {
  try {
    const resend = getResend();
    const amount = Number(opts.claimAmount || 0).toLocaleString('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    });
    await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: opts.to,
      subject: `[NSNP claim ${opts.decision}] ${opts.schoolName} · ${opts.periodFrom} → ${opts.periodTo}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5">
          <h2>Claim ${escapeHtml(opts.decision)}</h2>
          <p><strong>${escapeHtml(opts.schoolName)}</strong></p>
          <p>Period: ${escapeHtml(opts.periodFrom)} → ${escapeHtml(opts.periodTo)}</p>
          <p>Amount: <strong>${amount}</strong></p>
          ${opts.approverEmail ? `<p>DBE officer: ${escapeHtml(opts.approverEmail)}</p>` : ''}
          ${opts.reason ? `<p>Notes: ${escapeHtml(opts.reason)}</p>` : ''}
        </div>
      `,
    });
  } catch {
    /* soft */
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
