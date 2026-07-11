import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import {
  allocateBankTransaction,
  matchBankToInvoice,
  unallocateBankTransaction,
} from '@/lib/accounting/allocate';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST — allocate bank txn to GL or match to invoice
 * body: {
 *   companyId, privyUserId,
 *   action: 'allocate' | 'match_invoice' | 'exclude' | 'unexclude' | 'unallocate' | 'reallocate' | 'bulk_allocate',
 *   bank_transaction_id | ids[],
 *   gl_account_id?, invoice_id?, tax_amount?, tax_gl_account_id?, memo?, clear_tax?
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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    /** Accept UUID or numeric bank_transaction ids (production uses UUID). */
    const parseTxnId = (raw: unknown): string | number | null => {
      if (raw == null || raw === '') return null;
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      const s = String(raw).trim();
      if (!s) return null;
      if (/^\d+$/.test(s)) {
        const n = Number(s);
        return Number.isFinite(n) ? n : s;
      }
      return s;
    };

    if (action === 'exclude') {
      const id = parseTxnId(body.bank_transaction_id || body.id);
      if (id == null) {
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
      const id = parseTxnId(body.bank_transaction_id || body.id);
      if (id == null) {
        return NextResponse.json({ error: 'bank_transaction_id required' }, { status: 400 });
      }
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

    /** Undo GL/VAT allocation — voids linked journal and returns line to the queue */
    if (action === 'unallocate' || action === 'undo_allocate') {
      const ids: Array<string | number> = Array.isArray(body.ids)
        ? body.ids
            .map(parseTxnId)
            .filter((n: string | number | null): n is string | number => n != null)
        : (() => {
            const one = parseTxnId(body.bank_transaction_id || body.id);
            return one != null ? [one] : [];
          })();

      if (!ids.length) {
        return NextResponse.json(
          { error: 'bank_transaction_id or ids[] required' },
          { status: 400 }
        );
      }

      const clearTax = body.clear_tax === true || body.clearTax === true;
      const results: Array<{
        id: string | number;
        ok: boolean;
        error?: string;
        voidedJournalId?: number | null;
      }> = [];

      for (const id of ids) {
        const r = await unallocateBankTransaction({
          profileId: companyId,
          bankTxnId: id,
          privyUserId,
          clearTax,
        });
        if (r.ok) {
          results.push({ id, ok: true, voidedJournalId: r.voidedJournalId });
        } else {
          results.push({ id, ok: false, error: r.error });
        }
      }

      return NextResponse.json({
        success: true,
        unallocated: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      });
    }

    /** Unallocate then allocate again with new GL / tax (fix allocation errors) */
    if (action === 'reallocate') {
      const id = parseTxnId(body.bank_transaction_id || body.id);
      const glAccountId = Number(body.gl_account_id);
      if (id == null || !Number.isFinite(glAccountId)) {
        return NextResponse.json(
          { error: 'bank_transaction_id and gl_account_id required' },
          { status: 400 }
        );
      }

      const undo = await unallocateBankTransaction({
        profileId: companyId,
        bankTxnId: id,
        privyUserId,
        clearTax: false,
      });
      // Allow reallocate even if already unallocated
      if (!undo.ok && !String(undo.error || '').includes('already unallocated')) {
        return NextResponse.json({ error: undo.error }, { status: undo.status });
      }

      // Optional VAT re-code before posting
      if (body.tax_code || body.tax_amount != null) {
        const supabase = getSupabaseServer();
        const taxPatch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (body.tax_code) taxPatch.tax_code = String(body.tax_code).toUpperCase();
        if (body.tax_amount != null) taxPatch.tax_amount = Number(body.tax_amount);
        if (body.tax_inclusive != null) taxPatch.tax_inclusive = !!body.tax_inclusive;
        await supabase
          .from('bank_transactions')
          .update(taxPatch)
          .eq('id', id)
          .eq('profile_id', companyId);
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
        reallocated: true,
        voidedJournalId: undo.ok ? undo.voidedJournalId : null,
        journalId: result.journalId,
        entryNumber: result.entryNumber,
      });
    }

    if (action === 'match_invoice') {
      const id = parseTxnId(body.bank_transaction_id || body.id);
      const invoiceId = Number(body.invoice_id);
      if (id == null || !Number.isFinite(invoiceId)) {
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

    if (action === 'bulk_allocate' || action === 'mass_allocate') {
      /**
       * bulk_allocate: { ids[], gl_account_id }
       * mass_allocate: { assignments: [{ ids[], gl_account_id, memo? }] }
       *                or same shape as bulk_allocate
       */
      type Assignment = {
        ids: Array<string | number>;
        gl_account_id: number;
        memo?: string | null;
      };

      let assignments: Assignment[] = [];

      if (Array.isArray(body.assignments) && body.assignments.length) {
        for (const raw of body.assignments as Array<Record<string, unknown>>) {
          const ids = (Array.isArray(raw.ids) ? raw.ids : [])
            .map(parseTxnId)
            .filter((n): n is string | number => n != null);
          const glAccountId = Number(raw.gl_account_id);
          if (ids.length && Number.isFinite(glAccountId)) {
            assignments.push({
              ids,
              gl_account_id: glAccountId,
              memo: (raw.memo as string) || body.memo || null,
            });
          }
        }
      } else {
        const ids: Array<string | number> = Array.isArray(body.ids)
          ? body.ids
              .map(parseTxnId)
              .filter((n: string | number | null): n is string | number => n != null)
          : [];
        const glAccountId = Number(body.gl_account_id);
        if (ids.length && Number.isFinite(glAccountId)) {
          assignments = [{ ids, gl_account_id: glAccountId, memo: body.memo || null }];
        }
      }

      if (!assignments.length) {
        return NextResponse.json(
          {
            error:
              'Provide ids[] + gl_account_id, or assignments: [{ ids[], gl_account_id }]',
          },
          { status: 400 }
        );
      }

      // Cap to protect serverless timeouts (each allocation posts a journal)
      const maxIds = 400;
      let totalQueued = 0;
      for (const a of assignments) totalQueued += a.ids.length;
      if (totalQueued > maxIds) {
        return NextResponse.json(
          {
            error: `Too many lines in one request (max ${maxIds}). Split into smaller batches.`,
            queued: totalQueued,
          },
          { status: 400 }
        );
      }

      const results: Array<{
        id: string | number;
        ok: boolean;
        error?: string;
        journalId?: number;
        gl_account_id?: number;
      }> = [];

      for (const assignment of assignments) {
        for (const id of assignment.ids) {
          const r = await allocateBankTransaction({
            profileId: companyId,
            bankTxnId: id,
            glAccountId: assignment.gl_account_id,
            privyUserId,
            taxAmount: body.tax_amount != null ? Number(body.tax_amount) : 0,
            taxGlAccountId: body.tax_gl_account_id
              ? Number(body.tax_gl_account_id)
              : null,
            memo: assignment.memo || null,
            markReconciled: body.mark_reconciled !== false,
          });
          if (r.ok) {
            results.push({
              id,
              ok: true,
              journalId: r.journalId,
              gl_account_id: assignment.gl_account_id,
            });
          } else {
            results.push({
              id,
              ok: false,
              error: r.error,
              gl_account_id: assignment.gl_account_id,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        allocated: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        groups: assignments.length,
        results,
      });
    }

    // default: allocate single
    const id = parseTxnId(body.bank_transaction_id || body.id);
    const glAccountId = Number(body.gl_account_id);
    if (id == null || !Number.isFinite(glAccountId)) {
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
