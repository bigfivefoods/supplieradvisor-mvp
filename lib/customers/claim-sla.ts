/**
 * Claim SLA: nudge sellers when payment claims sit pending > threshold.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom } from '@/lib/resend';

const DEFAULT_HOURS = 24;

export async function runClaimSlaNudge(opts?: {
  hours?: number;
  limit?: number;
}): Promise<{
  scanned: number;
  nudged: number;
  errors: string[];
}> {
  const hours = opts?.hours ?? Number(process.env.CLAIM_SLA_HOURS || DEFAULT_HOURS);
  const limit = Math.min(80, opts?.limit ?? 40);
  const errors: string[] = [];
  let scanned = 0;
  let nudged = 0;

  const supabase = getSupabaseServer();
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { data: claims, error } = await supabase
    .from('customer_payment_claims')
    .select(
      'id, seller_profile_id, buyer_profile_id, invoice_id, amount, currency, reference, claimed_at, status, notes'
    )
    .eq('status', 'pending')
    .lt('claimed_at', cutoff)
    .order('claimed_at', { ascending: true })
    .limit(limit);

  if (error) {
    if (/relation|does not exist/i.test(error.message)) {
      return { scanned: 0, nudged: 0, errors: ['claims table missing'] };
    }
    return { scanned: 0, nudged: 0, errors: [error.message] };
  }

  const app =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com';
  const moneyHref = `${app.replace(/\/$/, '')}/dashboard/customers/money`;

  for (const c of claims || []) {
    scanned += 1;
    const notes = c.notes != null ? String(c.notes) : '';
    if (/\[claim sla nudged/i.test(notes)) continue;

    const sellerId = Number(c.seller_profile_id);
    if (!sellerId) continue;

    try {
      // Dedupe via activity_log if notes column missing
      const { count: recentNudge } = await supabase
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', sellerId)
        .eq('action', 'ar.payment_claim_sla_nudge')
        .eq('entity_id', String(c.id))
        .gte(
          'created_at',
          new Date(Date.now() - 20 * 3600 * 1000).toISOString()
        );
      if ((recentNudge || 0) > 0) continue;
      // Seller emails
      const { data: prof } = await supabase
        .from('profiles')
        .select('email, contact_email, trading_name, legal_name')
        .eq('id', sellerId)
        .maybeSingle();
      const emails = [prof?.email, prof?.contact_email]
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e.includes('@'));

      // Also finance members
      const { data: members } = await supabase
        .from('business_users')
        .select('email, role, status')
        .eq('profile_id', sellerId)
        .eq('status', 'active')
        .limit(20);
      for (const m of members || []) {
        const role = String(m.role || '').toLowerCase();
        if (
          ['owner', 'admin', 'finance', 'ops'].some((r) => role.includes(r)) &&
          m.email
        ) {
          emails.push(String(m.email).toLowerCase());
        }
      }
      const to = [...new Set(emails)].slice(0, 5);

      if (to.length && process.env.RESEND_API_KEY) {
        const ccy = String(c.currency || 'ZAR').toUpperCase();
        const amt = Number(c.amount || 0).toLocaleString();
        const resend = getResend();
        await resend.emails.send({
          from: getResendFrom(),
          to,
          subject: `[SupplierAdvisor] Claim waiting ${hours}h+ — confirm on Money hub`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#0f766e">Payment claim SLA</h2>
              <p>A buyer claim has been pending for more than <strong>${hours} hours</strong>.</p>
              <ul>
                <li>Amount: <strong>${ccy} ${amt}</strong></li>
                <li>Invoice #${c.invoice_id}</li>
                ${c.reference ? `<li>Ref: ${c.reference}</li>` : ''}
              </ul>
              <p>Confirm to post AR ledger (or reject if incorrect).</p>
              <p><a href="${moneyHref}" style="display:inline-block;background:#00b4d8;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Open Money hub →</a></p>
            </div>
          `,
        });
      }

      // Mark nudged (notes column may be missing — soft)
      const marker = `[claim sla nudged ${new Date().toISOString().slice(0, 10)}]`;
      const nextNotes = notes ? `${notes}\n${marker}` : marker;
      await supabase
        .from('customer_payment_claims')
        .update({ notes: nextNotes })
        .eq('id', c.id);

      try {
        await supabase.from('activity_log').insert({
          profile_id: sellerId,
          actor_user_id: 'system:claim-sla',
          action: 'ar.payment_claim_sla_nudge',
          entity_type: 'customer_payment_claims',
          entity_id: String(c.id),
          summary: `Claim #${c.id} pending >${hours}h — seller nudged`,
          metadata: { claimId: c.id, hours, invoiceId: c.invoice_id },
        });
      } catch {
        /* soft */
      }

      void import('@/lib/notifications/twilio-whatsapp')
        .then(({ whatsappPaymentClaimToSeller }) =>
          whatsappPaymentClaimToSeller({
            sellerProfileId: sellerId,
            invoiceId: Number(c.invoice_id),
            amount: Number(c.amount),
            currency: String(c.currency || 'ZAR'),
            reference: c.reference ? String(c.reference) : null,
          })
        )
        .catch(() => undefined);

      nudged += 1;
    } catch (e: unknown) {
      errors.push(
        `claim ${c.id}: ${e instanceof Error ? e.message : 'error'}`
      );
    }
  }

  return { scanned, nudged, errors };
}
