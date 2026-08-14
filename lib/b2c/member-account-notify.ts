/**
 * Notify the Advisor desk when a member pays or uploads proof.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { pushToCompany } from '@/lib/push/web-push';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { formatZar } from '@/lib/b2c/member-account-types';

export async function notifyAdvisorOfMemberPayment(opts: {
  companyId: number;
  title: string;
  body: string;
  amountZar: number;
  memberName: string;
  method: string;
  reference?: string | null;
  deskPath: string;
  actorUserId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseServer();
  try {
    await supabase.from('activity_log').insert({
      profile_id: opts.companyId,
      actor_user_id: opts.actorUserId || 'member',
      action: 'member_account.payment',
      entity_type: 'member_accounts',
      entity_id: opts.reference || 'payment',
      summary: opts.body,
      metadata: {
        amount_zar: opts.amountZar,
        member_name: opts.memberName,
        method: opts.method,
        reference: opts.reference || null,
      },
    });
  } catch {
    /* soft */
  }

  try {
    await pushToCompany(
      opts.companyId,
      {
        title: opts.title,
        body: opts.body,
        url: opts.deskPath,
        tag: 'member-account',
      },
      { topic: 'all' }
    );
  } catch {
    /* soft */
  }

  try {
    const { emails, tradingName } = await resolveCompanyEmails(opts.companyId, {
      roleAllowlist: ['owner', 'admin', 'finance', 'operations', 'ops'],
      limit: 6,
    });
    if (!emails.length) return;
    const resend = getResend();
    await resend.emails.send({
      from: getResendFrom(),
      to: emails,
      replyTo: getResendReplyTo(),
      subject: `${opts.title} · ${formatZar(opts.amountZar)}`,
      text: [
        tradingName ? `${tradingName}` : 'Advisor desk',
        '',
        opts.body,
        opts.reference ? `Reference: ${opts.reference}` : '',
        `Member: ${opts.memberName}`,
        `Method: ${opts.method}`,
        '',
        `Open: ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.supplieradvisor.com'}${opts.deskPath}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  } catch (err) {
    console.warn('[member-account notify]', err);
  }
}
