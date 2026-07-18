/**
 * Invoice share reliability — ensure buyer can see the document.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type ShareChecklist = {
  ok: boolean;
  invoiceId: number;
  checks: Array<{ id: string; ok: boolean; detail: string }>;
  visibility: string | null;
  sharedWithBuyer: boolean;
  hasContactEmail: boolean;
  customerId: number | null;
};

export async function ensureInvoiceSharedForBuyer(opts: {
  companyId: number;
  invoiceId: number;
  actorUserId?: string;
}): Promise<ShareChecklist> {
  const supabase = getSupabaseServer();
  const checks: ShareChecklist['checks'] = [];

  const { data: inv, error } = await supabase
    .from('customer_invoices')
    .select(
      'id, profile_id, customer_id, visibility, shared_with_buyer, contact_email, customer_name, status, invoice_number'
    )
    .eq('id', opts.invoiceId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();

  if (error || !inv) {
    return {
      ok: false,
      invoiceId: opts.invoiceId,
      checks: [
        {
          id: 'load',
          ok: false,
          detail: error?.message || 'Invoice not found',
        },
      ],
      visibility: null,
      sharedWithBuyer: false,
      hasContactEmail: false,
      customerId: null,
    };
  }

  const customerId = inv.customer_id ? Number(inv.customer_id) : null;
  checks.push({
    id: 'customer',
    ok: Boolean(customerId),
    detail: customerId
      ? `Customer #${customerId}`
      : 'No customer assigned — buyer cannot claim',
  });

  const email = String(inv.contact_email || '').includes('@');
  checks.push({
    id: 'email',
    ok: email,
    detail: email
      ? `Contact ${String(inv.contact_email).slice(0, 40)}`
      : 'No contact_email — set for buyer notify',
  });

  // Force share flags
  const updates: Record<string, unknown> = {
    visibility: 'shared',
    shared_with_buyer: true,
    updated_at: new Date().toISOString(),
  };
  let { error: uErr } = await supabase
    .from('customer_invoices')
    .update(updates)
    .eq('id', opts.invoiceId)
    .eq('profile_id', opts.companyId);

  if (uErr && /shared_with_buyer|visibility|column/i.test(uErr.message || '')) {
    const soft: Record<string, unknown> = {
      visibility: 'shared',
      updated_at: new Date().toISOString(),
    };
    const retry = await supabase
      .from('customer_invoices')
      .update(soft)
      .eq('id', opts.invoiceId)
      .eq('profile_id', opts.companyId);
    uErr = retry.error;
  }

  checks.push({
    id: 'visibility',
    ok: !uErr,
    detail: uErr
      ? `Share update failed: ${uErr.message}`
      : 'visibility=shared (+ shared_with_buyer when column exists)',
  });

  // Soft notify buyer if linked profile
  if (customerId) {
    try {
      const { data: cust } = await supabase
        .from('customers')
        .select('linked_profile_id, email, trading_name, name')
        .eq('id', customerId)
        .maybeSingle();
      const buyerId = cust?.linked_profile_id
        ? Number(cust.linked_profile_id)
        : 0;
      if (buyerId > 0) {
        const { notifyInvoiceSentToBuyer } = await import(
          '@/lib/notifications/email-alerts'
        );
        const { data: seller } = await supabase
          .from('profiles')
          .select('trading_name, legal_name')
          .eq('id', opts.companyId)
          .maybeSingle();
        await notifyInvoiceSentToBuyer({
          buyerProfileId: buyerId,
          sellerName: String(
            seller?.trading_name || seller?.legal_name || 'Supplier'
          ),
          sellerProfileId: opts.companyId,
          invoiceId: opts.invoiceId,
          invoiceNumber: inv.invoice_number
            ? String(inv.invoice_number)
            : `#${opts.invoiceId}`,
        });
        checks.push({
          id: 'buyer_notify',
          ok: true,
          detail: `Notified linked buyer #${buyerId}`,
        });
      } else {
        checks.push({
          id: 'buyer_notify',
          ok: false,
          detail: 'Customer not linked to a platform company — email PDF only',
        });
      }
    } catch (e: unknown) {
      checks.push({
        id: 'buyer_notify',
        ok: false,
        detail: e instanceof Error ? e.message : 'notify soft-fail',
      });
    }
  }

  const ok = checks.every((c) => c.id === 'buyer_notify' || c.ok);
  return {
    ok: checks.filter((c) => c.id !== 'buyer_notify' && c.id !== 'email').every((c) => c.ok),
    invoiceId: opts.invoiceId,
    checks,
    visibility: 'shared',
    sharedWithBuyer: true,
    hasContactEmail: email,
    customerId,
  };
}
