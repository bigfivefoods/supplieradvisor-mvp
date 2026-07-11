import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { parseBankCsv, type ParseResult } from '@/lib/accounting/csv';
import { parseBankPdfBuffer, linesToCsv } from '@/lib/accounting/pdf-statement';
import {
  fromParsedLine,
  ingestCanonicalTxns,
  startSyncRun,
  finishSyncRun,
} from '@/lib/banking';

type ImportBody = {
  companyId?: unknown;
  privyUserId?: string;
  bank_account_id?: unknown;
  csv?: string;
  pdfBase64?: string;
  filename?: string;
  format?: string;
  dryRun?: boolean | string;
};

async function readImportPayload(request: NextRequest): Promise<{
  body: ImportBody;
  pdfBuffer: Buffer | null;
}> {
  const contentType = request.headers.get('content-type') || '';

  // Multipart: preferred for PDFs (avoids huge base64 JSON bodies)
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    let pdfBuffer: Buffer | null = null;
    let filename = String(form.get('filename') || '');
    if (file instanceof File) {
      pdfBuffer = Buffer.from(await file.arrayBuffer());
      filename = filename || file.name || 'statement.pdf';
    }
    return {
      body: {
        companyId: form.get('companyId'),
        privyUserId: String(form.get('privyUserId') || '') || undefined,
        bank_account_id: form.get('bank_account_id'),
        csv: form.get('csv') != null ? String(form.get('csv')) : undefined,
        filename,
        format: String(form.get('format') || 'auto'),
        dryRun: form.get('dryRun') === 'true' || form.get('dryRun') === '1',
      },
      pdfBuffer,
    };
  }

  const body = (await request.json()) as ImportBody;
  let pdfBuffer: Buffer | null = null;
  if (body.pdfBase64) {
    let b64 = String(body.pdfBase64);
    const comma = b64.indexOf(',');
    if (b64.startsWith('data:') && comma >= 0) b64 = b64.slice(comma + 1);
    pdfBuffer = Buffer.from(b64, 'base64');
  }
  return { body, pdfBuffer };
}

async function storeStatementPdf(
  companyId: number,
  bankAccountId: number,
  filename: string,
  buffer: Buffer
): Promise<{ storage_path?: string; public_url?: string; storage_error?: string }> {
  try {
    const supabase = getSupabaseServer();
    const safe = (filename || 'statement.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const path = `${companyId}/bank-statements/${bankAccountId}/${Date.now()}-${safe}`;
    const buckets = ['company-documents', 'certificates'];
    const errors: string[] = [];
    for (const bucket of buckets) {
      const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf',
      });
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return { storage_path: `${bucket}/${path}`, public_url: data.publicUrl };
      }
      errors.push(`${bucket}: ${error.message}`);
    }
    return { storage_error: errors.join('; ') };
  } catch (e) {
    return { storage_error: e instanceof Error ? e.message : 'storage failed' };
  }
}

/**
 * POST — import bank statement CSV or PDF
 * JSON body or multipart/form-data:
 *   companyId, privyUserId, bank_account_id,
 *   csv? | pdfBase64? | file (multipart),
 *   filename?, format?: 'auto'|'fnb'|'rmb'|'universal',
 *   dryRun?: boolean
 *
 * Saves parsed lines to bank_transactions for allocation / management accounts.
 * PDF statements are also stored in Supabase Storage when possible.
 */
export async function POST(request: NextRequest) {
  try {
    const { body, pdfBuffer } = await readImportPayload(request);
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
    let statementStorage: {
      storage_path?: string;
      public_url?: string;
      storage_error?: string;
    } = {};

    if (pdfBuffer && pdfBuffer.length > 0) {
      source = 'pdf';
      if (pdfBuffer.length < 100) {
        return NextResponse.json({ error: 'PDF file is empty or invalid' }, { status: 400 });
      }
      if (pdfBuffer.length > 12 * 1024 * 1024) {
        return NextResponse.json({ error: 'PDF too large (max 12MB)' }, { status: 400 });
      }
      if (pdfBuffer.subarray(0, 4).toString() !== '%PDF') {
        return NextResponse.json(
          { error: 'File does not look like a PDF. Upload a .pdf statement.' },
          { status: 400 }
        );
      }
      parsed = await parseBankPdfBuffer(pdfBuffer);
      if (!dryRun) {
        statementStorage = await storeStatementPdf(
          companyId,
          bankAccountId,
          filename || 'statement.pdf',
          pdfBuffer
        );
      }
    } else if (body.csv) {
      parsed = parseBankCsv(String(body.csv), formatHint);
      parsed.csv = String(body.csv);
    } else {
      return NextResponse.json(
        { error: 'Provide a PDF file, pdfBase64, or csv text' },
        { status: 400 }
      );
    }

    if (parsed.lines.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No transactions parsed from the statement. Text-based PDFs work best — scanned image-only PDFs need OCR, or export CSV from your bank.',
          warnings: parsed.warnings,
          format: parsed.format,
          skipped: parsed.skipped,
          source,
          textPreview: parsed.textPreview,
        },
        { status: 400 }
      );
    }

    const canonical = parsed.lines.map((l) => fromParsedLine(source, l));
    const csvOut = parsed.csv || linesToCsv(parsed.lines);

    if (dryRun) {
      const preview = await ingestCanonicalTxns({
        companyId,
        bankAccountId,
        txns: canonical,
        currency: bank.currency || 'ZAR',
        dryRun: true,
      });
      return NextResponse.json({
        success: true,
        dryRun: true,
        source,
        format: source === 'pdf' ? 'pdf' : parsed.format,
        pages: parsed.pages,
        parsed: parsed.lines.length,
        wouldImport: preview.fetched - preview.duplicates,
        duplicates: preview.duplicates,
        skipped: parsed.skipped,
        warnings: parsed.warnings,
        preview: parsed.lines.slice(0, 25),
        csv: csvOut,
        middleware: true,
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
        duplicate_count: 0,
        imported_by: privyUserId || null,
        metadata: {
          format_hint: formatHint,
          pages: parsed.pages,
          middleware: true,
          ...statementStorage,
        },
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

    const runId = await startSyncRun({
      companyId,
      bankAccountId,
      provider: source,
      trigger: 'import',
    });

    const ingest = await ingestCanonicalTxns({
      companyId,
      bankAccountId,
      txns: canonical,
      currency: bank.currency || 'ZAR',
      importBatchId: batchId,
      syncRunId: runId,
      privyUserId,
      // Score + apply only very high-confidence matches after import
      autoMatch: true,
      autoMatchMinConfidence: 90,
    });

    await finishSyncRun(runId, ingest);

    if (batchId) {
      await supabase
        .from('bank_import_batches')
        .update({
          imported_count: ingest.inserted,
          duplicate_count: ingest.duplicates,
          metadata: {
            format_hint: formatHint,
            pages: parsed.pages,
            middleware: true,
            ...statementStorage,
          },
        })
        .eq('id', batchId);
    }

    await supabase
      .from('bank_accounts')
      .update({
        import_format: source === 'pdf' ? 'pdf' : parsed.format,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bankAccountId);

    if (ingest.errors > 0 && ingest.inserted === 0) {
      return NextResponse.json(
        {
          success: false,
          error: ingest.error_message || 'Import failed',
          imported: ingest.inserted,
          duplicates: ingest.duplicates,
          hint: ingest.error_message?.includes('allocation_status')
            ? 'Run supabase/migrations/20260710_accounting_bank_allocation.sql'
            : ingest.error_message?.includes('provider')
              ? 'Run supabase/migrations/20260711_bank_middleware.sql'
              : undefined,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      source,
      format: source === 'pdf' ? 'pdf' : parsed.format,
      batch_id: batchId,
      parsed: parsed.lines.length,
      imported: ingest.inserted,
      duplicates: ingest.duplicates,
      auto_matched: ingest.auto_matched || 0,
      skipped: parsed.skipped,
      warnings: parsed.warnings,
      csv: csvOut,
      middleware: true,
      sync_run_id: runId,
      statement: statementStorage.public_url
        ? {
            url: statementStorage.public_url,
            path: statementStorage.storage_path,
          }
        : statementStorage.storage_error
          ? { storage_error: statementStorage.storage_error }
          : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
