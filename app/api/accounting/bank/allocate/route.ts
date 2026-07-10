import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import {
  allocateBankTransaction,
  matchBankToInvoice,
} from '@/lib/accounting/allocate';

/**
 * POST — allocate bank txn to GL or match to invoice
 * body: {
 *   companyId, privyUserId,
 *   action: 'allocate' | 'match_invoice' | 'exclude' | 'bulk_allocate',
 *   bank_transaction_id | ids[],
 *   gl_account_id?, invoice_id?, tax_amount?, tax_gl_account_id?, memo?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const action = String(body.action || 'allocate');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    if (action === 'exclude') {
      const id = Number(body.bank_transaction_id || body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'bank_transaction_id required' }, { status: 400 });
      }
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from('bank_transactions')
        .update({
          allocation_status: 'excluded',
          status: 'excluded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, transaction: data });
    }

    if (action === 'unexclude') {
      const id = Number(body.bank_transaction_id || body.id);
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from('bank_transactions')
        .update({
          allocation_status: 'unallocated',
          status: 'unreconciled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, transaction: data });
    }

    if (action === 'match_invoice') {
      const id = Number(body.bank_transaction_id || body.id);
      const invoiceId = Number(body.invoice_id);
      if (!Number.isFinite(id) || !Number.isFinite(invoiceId)) {
        return NextResponse.json(
          { error: 'bank_transaction_id and invoice_id required' },
          { status: 400 }
        );
      }
      const result = await matchBankToInvoice({
        profileId: companyId,
        bankTxnId: id,
        invoiceId,
        privyUserId,
        method: body.method || 'eft',
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, paymentId: result.paymentId });
    }

    if (action === 'bulk_allocate') {
      const ids: number[] = Array.isArray(body.ids)
        ? body.ids.map(Number).filter((n: number) => Number.isFinite(n))
        : [];
      const glAccountId = Number(body.gl_account_id);
      if (!ids.length || !Number.isFinite(glAccountId)) {
        return NextResponse.json(
          { error: 'ids[] and gl_account_id required' },
          { status: 400 }
        );
      }
      const results: Array<{ id: number; ok: boolean; error?: string; journalId?: number }> = [];
      for (const id of ids) {
        const r = await allocateBankTransaction({
          profileId: companyId,
          bankTxnId: id,
          glAccountId,
          privyUserId,
          taxAmount: body.tax_amount != null ? Number(body.tax_amount) : 0,
          taxGlAccountId: body.tax_gl_account_id ? Number(body.tax_gl_account_id) : null,
          memo: body.memo || null,
          markReconciled: body.mark_reconciled !== false,
        });
        if (r.ok) results.push({ id, ok: true, journalId: r.journalId });
        else results.push({ id, ok: false, error: r.error });
      }
      return NextResponse.json({
        success: true,
        allocated: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      });
    }

    // default: allocate single
    const id = Number(body.bank_transaction_id || body.id);
    const glAccountId = Number(body.gl_account_id);
    if (!Number.isFinite(id) || !Number.isFinite(glAccountId)) {
      return NextResponse.json(
        { error: 'bank_transaction_id and gl_account_id required' },
        { status: 400 }
      );
    }

    const result = await allocateBankTransaction({
      profileId: companyId,
      bankTxnId: id,
      glAccountId,
      privyUserId,
      taxAmount: body.tax_amount != null ? Number(body.tax_amount) : 0,
      taxGlAccountId: body.tax_gl_account_id ? Number(body.tax_gl_account_id) : null,
      memo: body.memo || null,
      counterparty: body.counterparty || null,
      markReconciled: body.mark_reconciled !== false,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      journalId: result.journalId,
      entryNumber: result.entryNumber,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
