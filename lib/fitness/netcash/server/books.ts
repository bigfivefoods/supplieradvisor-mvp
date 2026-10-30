import 'server-only';
import { syncCrmInvoiceToBooks } from '@/lib/accounting/crm-invoice-gl';
import { settleInvoicePayment } from '@/lib/accounting/invoice-gl';
import { centsToRands } from '@/lib/fitness/netcash/money';
import { lineItemsForBooks, type InvoicePort } from '@/lib/fitness/netcash/invoices';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export function supabaseInvoices(): InvoicePort {
  const db = getSupabaseServer();
  return {
    async issue(input) {
      const now = new Date().toISOString();
      const items = lineItemsForBooks(input.items);
      const payload = {
        profile_id: input.companyId,
        customer_id: input.crmCustomerId,
        invoice_number: input.number,
        status: input.kind === 'credit_note' ? 'sent' : 'sent',
        currency: 'ZAR',
        subtotal: centsToRands(input.netCents),
        tax_rate: input.vatBps / 100,
        tax_amount: centsToRands(input.vatCents),
        total_amount: centsToRands(input.totalCents),
        amount_paid: 0,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        customer_name: input.memberName,
        contact_email: input.email || null,
        contact_phone: input.phone || null,
        notes: input.kind === 'credit_note'
          ? `GymAdvisor® credit note for ${input.originalNumber || 'a debit order'}. ${input.notes}`
          : input.notes,
        items,
        metadata: {
          source: 'gym_netcash',
          document_kind: input.kind,
          original_invoice_number: input.originalNumber || null,
        },
        created_at: now,
        updated_at: now,
      };
      let inserted = await db.from('customer_invoices').insert(payload).select('id, invoice_number').single();
      if (inserted.error) {
        inserted = await db.from('customer_invoices').insert({
          profile_id: input.companyId,
          customer_id: input.crmCustomerId,
          invoice_number: input.number,
          status: 'sent',
          currency: 'ZAR',
          subtotal: payload.subtotal,
          tax_amount: payload.tax_amount,
          total_amount: payload.total_amount,
          customer_name: input.memberName,
          contact_email: input.email || null,
          notes: payload.notes,
          items,
          issue_date: input.issueDate,
          due_date: input.dueDate,
          created_at: now,
          updated_at: now,
        }).select('id, invoice_number').single();
      }
      if (inserted.error || !inserted.data?.id) {
        return { ok: false, error: inserted.error?.message || 'Invoice was not created.' };
      }
      const id = Number(inserted.data.id);
      try {
        await syncCrmInvoiceToBooks({
          profileId: input.companyId,
          crmInvoice: { ...payload, id, status: 'sent' },
          createdBy: 'gym-netcash',
        });
      } catch {
        // The customer invoice exists. Finance posting can be retried from the books.
      }
      return { ok: true, invoiceId: id };
    },
    async markPaid(input) {
      if (!input.invoiceId) return { ok: false, error: 'Invoice id missing' };
      const now = input.paidAt || new Date().toISOString();
      const amount = centsToRands(input.totalCents);
      const { error } = await db.from('customer_invoices').update({
        status: 'paid',
        amount_paid: amount,
        paid_at: now,
        updated_at: now,
      }).eq('id', input.invoiceId).eq('profile_id', input.companyId);
      if (error) return { ok: false, error: error.message };
      await db.from('customer_invoice_payments').insert({
        profile_id: input.companyId,
        invoice_id: input.invoiceId,
        amount,
        currency: 'ZAR',
        paid_at: now,
        method: 'debit_order',
        reference: input.reference,
        notes: 'Netcash debit order',
        created_by: 'gym-netcash',
      });
      try {
        const twin = await db.from('invoices').select('*').eq('profile_id', input.companyId).eq('invoice_number', input.number).maybeSingle();
        if (twin.data?.id) {
          await settleInvoicePayment({
            profileId: input.companyId,
            invoice: twin.data as Record<string, unknown>,
            paymentId: Number(twin.data.id),
            amount,
            paidAt: now,
            createdBy: 'gym-netcash',
          });
        }
      } catch {
        return { ok: true };
      }
      return { ok: true };
    },
  };
}
