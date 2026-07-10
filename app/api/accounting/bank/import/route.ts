import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, round2 } from '@/lib/accounting/server';
import { parseBankCsv, type ParseResult } from '@/lib/accounting/csv';
import { parseBankPdfBuffer, linesToCsv } from '@/lib/accounting/pdf-statement';

/**
 * POST — import bank statement CSV or PDF
 * body: {
 *   companyId, privyUserId, bank_account_id,
 *   csv?: string,
 *   pdfBase64?: string,  // raw base64 or data:application/pdf;base64,...
 *   filename?, format?: 'auto'|'fnb'|'rmb'|'universal',
 *   dryRun?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const bankAccountId = Number(body.bank_account_id);
    const dryRun = !!body.dryRun;
    const formatHint = String(body.format || 'auto');
    const filename = String(body.filename || '');

    if (!Number.isFinite(companyId) || !Number.isFinite(bankAccountId)) {
      return NextResponse.json(
        { error: 'companyId and bank_account_id required' },
        { status: 400 }
      );
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { data: bank, error: bankErr } = await supabase
      .from('bank_accounts')
      .select('id, name, currency, current_balance')
      .eq('id', bankAccountId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (bankErr || !bank) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    let parsed: ParseResult & { csv?: string; pages?: number; textPreview?: string };
    let source: 'csv' | 'pdf' = 'csv';

    if (body.pdfBase64) {
      source = 'pdf';
      let b64 = String(body.pdfBase64);
      const comma = b64.indexOf(',');
      if (b64.startsWith('data:') && comma >= 0) b64 = b64.slice(comma + 1);
      const buffer = Buffer.from(b64, 'base64');
      if (buffer.length < 100) {
        return NextResponse.json({ error: 'PDF file is empty or invalid' }, { status: 400 });
      }
      if (buffer.length > 12 * 1024 * 1024) {
        return NextResponse.json({ error: 'PDF too large (max 12MB)' }, { status: 400 });
      }
      // quick magic check
      if (buffer.subarray(0, 4).toString() !== '%PDF') {
        return NextResponse.json(
          { error: 'File does not look like a PDF. Upload a .pdf statement.' },
          { status: 400 }
        );
      }
      parsed = await parseBankPdfBuffer(buffer);
    } else if (body.csv) {
      parsed = parseBankCsv(String(body.csv), formatHint);
      parsed.csv = String(body.csv);
    } else {
      return NextResponse.json(
        { error: 'Provide csv text or pdfBase64' },
        { status: 400 }
      );
    }

    if (parsed.lines.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No transactions parsed',
          warnings: parsed.warnings,
          format: parsed.format,
          skipped: parsed.skipped,
          source,
          textPreview: parsed.textPreview,
        },
        { status: 400 }
      );
    }

    const externalIds = parsed.lines.map((l) => l.external_id);
    const existing = new Set<string>();
    for (let i = 0; i < externalIds.length; i += 100) {
      const chunk = externalIds.slice(i, i + 100);
      const { data: rows } = await supabase
        .from('bank_transactions')
        .select('external_id')
        .eq('profile_id', companyId)
        .eq('bank_account_id', bankAccountId)
        .in('external_id', chunk);
      for (const r of rows || []) {
        if (r.external_id) existing.add(String(r.external_id));
      }
    }

    const toInsert = parsed.lines.filter((l) => !existing.has(l.external_id));
    const duplicates = parsed.lines.length - toInsert.length;
    const csvOut = parsed.csv || linesToCsv(parsed.lines);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        source,
        format: source === 'pdf' ? 'pdf' : parsed.format,
        pages: parsed.pages,
        parsed: parsed.lines.length,
        wouldImport: toInsert.length,
        duplicates,
        skipped: parsed.skipped,
        warnings: parsed.warnings,
        preview: toInsert.slice(0, 25),
        csv: csvOut,
      });
    }

    const { data: batch, error: batchErr } = await supabase
      .from('bank_import_batches')
      .insert({
        profile_id: companyId,
        bank_account_id: bankAccountId,
        source,
        filename: filename || null,
        format_hint: source === 'pdf' ? 'pdf' : parsed.format,
        row_count: parsed.lines.length,
        imported_count: 0,
        skipped_count: parsed.skipped,
        duplicate_count: duplicates,
        imported_by: privyUserId || null,
        metadata: { format_hint: formatHint, pages: parsed.pages },
      })
      .select('*')
      .single();

    let batchId: number | null = null;
    if (batchErr || !batch) {
      if (!(batchErr?.message?.includes('does not exist') || batchErr?.code === '42P01')) {
        return NextResponse.json(
          {
            error: batchErr?.message || 'Failed to create import batch',
            hint: 'Run supabase/migrations/20260710_accounting_bank_allocation.sql',
          },
          { status: 400 }
        );
      }
    } else {
      batchId = batch.id;
    }

    const rows = toInsert.map((l) => ({
      profile_id: companyId,
      bank_account_id: bankAccountId,
      txn_date: l.txn_date,
      description: l.description,
      reference: l.reference,
      amount: l.amount,
      currency: bank.currency || 'ZAR',
      status: 'unreconciled',
      allocation_status: 'unallocated',
      balance_after: l.balance_after,
      counterparty_name: l.counterparty_name,
      external_id: l.external_id,
      import_batch_id: batchId,
      metadata: { import_raw: l.raw, format: source === 'pdf' ? 'pdf' : parsed.format, source },
    }));

    let imported = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { data: inserted, error: insErr } = await supabase
        .from('bank_transactions')
        .insert(chunk)
        .select('id');
      if (insErr) {
        return NextResponse.json(
          {
            success: false,
            error: insErr.message,
            imported,
            hint: insErr.message.includes('allocation_status')
              ? 'Run supabase/migrations/20260710_accounting_bank_allocation.sql'
              : undefined,
          },
          { status: 400 }
        );
      }
      imported += inserted?.length || chunk.length;
    }

    if (batchId) {
      await supabase
        .from('bank_import_batches')
        .update({ imported_count: imported })
        .eq('id', batchId);
    }

    const withBal = [...toInsert]
      .filter((l) => l.balance_after != null)
      .sort((a, b) => a.txn_date.localeCompare(b.txn_date));
    if (withBal.length > 0) {
      const last = withBal[withBal.length - 1];
      await supabase
        .from('bank_accounts')
        .update({
          current_balance: round2(Number(last.balance_after)),
          last_import_at: new Date().toISOString(),
          import_format: source === 'pdf' ? 'pdf' : parsed.format,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bankAccountId);
    } else {
      const delta = toInsert.reduce((s, l) => s + l.amount, 0);
      await supabase
        .from('bank_accounts')
        .update({
          current_balance: round2(Number(bank.current_balance || 0) + delta),
          last_import_at: new Date().toISOString(),
          import_format: source === 'pdf' ? 'pdf' : parsed.format,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bankAccountId);
    }

    return NextResponse.json({
      success: true,
      source,
      format: source === 'pdf' ? 'pdf' : parsed.format,
      batch_id: batchId,
      parsed: parsed.lines.length,
      imported,
      duplicates,
      skipped: parsed.skipped,
      warnings: parsed.warnings,
      csv: csvOut,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
