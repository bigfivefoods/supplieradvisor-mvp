/**
 * Email members/patients when coaches or desk send a care message
 * in GymAdvisor / clinic portals (in-app + email).
 */
import { getResend, getResendFrom, getAppUrl } from '@/lib/resend';
import type { ServiceThread } from '@/lib/messaging/service-inbox';

export async function sendServiceCareMessageEmail(opts: {
  to: string;
  memberName: string;
  brand: string;
  authorName: string;
  body: string;
  /** Member portal path e.g. /member/fitgraph/TOKEN */
  portalPath?: string | null;
  moduleLabel?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const resend = getResend();
    if (!resend) {
      return { ok: false, error: 'Email not configured (RESEND_API_KEY)' };
    }
    const to = String(opts.to || '')
      .toLowerCase()
      .trim();
    if (!to || !to.includes('@')) {
      return { ok: false, error: 'No member email' };
    }
    const app = getAppUrl();
    const manage =
      opts.portalPath && opts.portalPath.startsWith('http')
        ? opts.portalPath
        : opts.portalPath
          ? `${app}${opts.portalPath.startsWith('/') ? '' : '/'}${opts.portalPath}`
          : app;
    const preview = String(opts.body || '')
      .trim()
      .slice(0, 400);
    const subject = `Message from ${opts.authorName} · ${opts.brand}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">
          ${escapeHtml(opts.moduleLabel || 'SupplierAdvisor')} · Message
        </p>
        <h1 style="font-size:18px;margin:8px 0 12px">Hi ${escapeHtml(opts.memberName || 'there')},</h1>
        <p style="font-size:15px;line-height:1.5;color:#334155">
          <strong>${escapeHtml(opts.authorName)}</strong> at
          <strong>${escapeHtml(opts.brand)}</strong> sent you a message:
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;white-space:pre-wrap;font-size:14px;line-height:1.5">
${escapeHtml(preview)}
        </div>
        <p style="font-size:14px">
          <a href="${escapeHtml(manage)}" style="color:#7c3aed;font-weight:700">Open portal to reply</a>
        </p>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px">
          Powered by SupplierAdvisor®
        </p>
      </div>
    `;
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      to,
      subject,
      html,
    });
    if (error) {
      return { ok: false, error: error.message || 'Send failed' };
    }
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Email failed',
    };
  }
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * After coach/desk posts on a care thread, email every member participant
 * who has an address on file (primary or invite email).
 */
export async function notifyMembersOnServiceThread(opts: {
  thread: ServiceThread;
  people: Array<{
    id: string;
    name?: string;
    email?: string | null;
    invite_email?: string | null;
    portal_token?: string | null;
    /** When set, recipient is on the system — in-app only, no email */
    platform_user_id?: string | null;
  }>;
  brand: string;
  moduleLabel?: string;
  /** e.g. /member/fitgraph */
  portalBasePath: string;
  /** Only email if last author is staff */
  staffRoles?: string[];
}): Promise<{ emailed: number; errors: string[] }> {
  const msgs = opts.thread.messages || [];
  const last = msgs[msgs.length - 1];
  if (!last || !String(last.body || '').trim()) {
    return { emailed: 0, errors: [] };
  }
  const staff = new Set(
    opts.staffRoles || ['desk', 'coach', 'practitioner']
  );
  if (!staff.has(String(last.author_role || ''))) {
    return { emailed: 0, errors: [] };
  }
  const memberRoles = new Set(['member', 'patient']);
  const peopleById = new Map(opts.people.map((p) => [String(p.id), p]));
  let emailed = 0;
  const errors: string[] = [];
  for (const p of opts.thread.participants || []) {
    if (!memberRoles.has(String(p.role))) continue;
    const person = peopleById.get(String(p.ref_id)) as
      | {
          id: string;
          name?: string;
          email?: string | null;
          invite_email?: string | null;
          portal_token?: string | null;
          platform_user_id?: string | null;
        }
      | undefined;
    if (!person) continue;
    // Once on the system, messaging is in-app by platform_user_id — skip email
    if (person.platform_user_id) {
      continue;
    }
    const email = String(person.email || person.invite_email || '')
      .toLowerCase()
      .trim();
    if (!email || !email.includes('@')) {
      errors.push(`no email for ${person.name || p.ref_id}`);
      continue;
    }
    const portalPath = person.portal_token
      ? `${opts.portalBasePath}/${person.portal_token}`
      : null;
    const r = await sendServiceCareMessageEmail({
      to: email,
      memberName: person.name || p.name || 'Member',
      brand: opts.brand,
      authorName: last.author_name || 'Coach',
      body: last.body,
      portalPath,
      moduleLabel: opts.moduleLabel,
    });
    if (r.ok) emailed++;
    else errors.push(r.error || 'send failed');
  }
  return { emailed, errors };
}
