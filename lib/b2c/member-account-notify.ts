/**
 * Notify the Advisor desk when a member pays or uploads proof,
 * and notify the member when an Advisor raises an invoice.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { pushToCompany } from '@/lib/push/web-push';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  formatZar,
  type AdvisorAccountModule,
  type MemberAccountCharge,
} from '@/lib/b2c/member-account-types';
import { notifyLinkedMember } from '@/lib/b2c/member-push';
import { sendAdvisorInvoiceEmail } from '@/lib/services/advisor-branded-email';

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
      tags: [{ name: 'company_id', value: String(opts.companyId) }],
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

export async function notifyMemberOfAdvisorInvoice(opts: {
  companyId: number;
  companyName: string;
  brand?: string | null;
  logoUrl?: string | null;
  module: AdvisorAccountModule;
  charge: MemberAccountCharge;
  portalPath?: string | null;
}): Promise<{ emailed: boolean; pushed: number }> {
  const brand = opts.brand || opts.companyName || 'Your Advisor';
  const amount = formatZar(opts.charge.amount_zar);
  const inv = opts.charge.invoice_number || '';
  const walletUrl = `${getAppUrl()}/me?tab=account`;

  let pushed = 0;
  try {
    const r = await notifyLinkedMember({
      platformUserId: opts.charge.member_user_id,
      title: inv ? `Invoice ${inv} from ${brand}` : `Invoice from ${brand}`,
      body: `${opts.charge.description} · ${amount}. Open SA Member to view and pay.`,
      url: '/me?tab=account',
      tag: `invoice-${opts.charge.id}`,
      topic: 'bookings',
    });
    pushed = r.sent;
  } catch {
    /* soft */
  }

  const to = String(opts.charge.member_email || '').trim();
  if (!to.includes('@')) return { emailed: false, pushed };

  try {
    const sent = await sendAdvisorInvoiceEmail(to, {
      personName: opts.charge.member_name,
      brand,
      description: opts.charge.description,
      amountLabel: amount,
      invoiceNumber: inv || null,
      dueDate: opts.charge.due_date || null,
      logoUrl: opts.logoUrl || null,
      ctaUrl: walletUrl,
      moduleKey: opts.module,
    });
    if (!sent.ok) {
      console.warn('[member-account] invoice email', sent.error);
    }
    return { emailed: sent.ok, pushed };
  } catch (err) {
    console.warn('[member-account] invoice email', err);
    return { emailed: false, pushed };
  }
}
