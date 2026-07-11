import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  banklinkConfig,
  fetchBankLinkTransactions,
  ingestCanonicalTxns,
  startSyncRun,
  finishSyncRun,
  sandboxTransactions,
  triggerBankLinkSync,
} from '@/lib/banking';

/**
 * GET/POST /api/banking/cron-sync
 *
 * Scheduled sync of all active bank_connections (Vercel Cron).
 * Auth: Authorization: Bearer $CRON_SECRET  (or x-cron-secret header)
 *
 * Optional: ?companyId=123 to scope to one company.
 */
async function runCron(request: NextRequest) {
  const cronSecret =
    process.env.CRON_SECRET || process.env.BANK_CRON_SECRET || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const headerSecret = (request.headers.get('x-cron-secret') || '').trim();
  const isCron =
    Boolean(cronSecret) &&
    (bearer === cronSecret || headerSecret === cronSecret);

  // Allow Vercel Cron which sends Authorization: Bearer <CRON_SECRET>
  // Also allow when CRON_SECRET unset in dev with ?dev=1
  const devOk =
    process.env.NODE_ENV !== 'production' &&
    request.nextUrl.searchParams.get('dev') === '1';

  if (!isCron && !devOk) {
    return NextResponse.json(
      {
        error: 'Unauthorized — set CRON_SECRET and send Authorization: Bearer <secret>',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  }

  const scopedCompany = request.nextUrl.searchParams.get('companyId');
  const companyFilter =
    scopedCompany && Number.isFinite(Number(scopedCompany))
      ? Number(scopedCompany)
      : null;

  const supabase = getSupabaseServer();
  let q = supabase
    .from('bank_connections')
    .select('*')
    .eq('status', 'active')
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(50);

  if (companyFilter) q = q.eq('profile_id', companyFilter);

  const { data: connections, error } = await q;
  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: 'Run supabase/migrations/20260711_bank_middleware.sql',
      },
      { status: 400 }
    );
  }

  const cfg = banklinkConfig();
  const results: Array<Record<string, unknown>> = [];

  for (const conn of connections || []) {
    const companyId = Number(conn.profile_id);
    const bankAccountId = Number(conn.bank_account_id);
    if (!Number.isFinite(companyId) || !Number.isFinite(bankAccountId)) {
      results.push({
        connectionId: conn.id,
        skipped: true,
        reason: 'missing company or bank account',
      });
      continue;
    }

    const externalAccountId = String(
      conn.external_account_id || conn.external_connection_id || ''
    );

    try {
      if (conn.provider === 'banklink' && cfg.mode === 'live' && externalAccountId) {
        await triggerBankLinkSync(externalAccountId);
      }

      let txns =
        conn.provider === 'sandbox' || cfg.mode === 'sandbox'
          ? sandboxTransactions()
          : [];

      if (conn.provider === 'banklink' && cfg.mode === 'live' && externalAccountId) {
        const pulled = await fetchBankLinkTransactions({
          accountId: externalAccountId,
        });
        if (pulled.error && !pulled.txns.length) {
          results.push({
            connectionId: conn.id,
            error: pulled.error,
          });
          await supabase
            .from('bank_connections')
            .update({
              last_error: pulled.error,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conn.id);
          continue;
        }
        txns = pulled.txns;
      }

      if (!txns.length) {
        results.push({
          connectionId: conn.id,
          skipped: true,
          reason: 'no transactions returned',
        });
        continue;
      }

      const runId = await startSyncRun({
        companyId,
        connectionId: Number(conn.id),
        bankAccountId,
        provider: String(conn.provider || 'banklink'),
        trigger: 'cron',
      });

      const ingest = await ingestCanonicalTxns({
        companyId,
        bankAccountId,
        txns,
        connectionId: Number(conn.id),
        syncRunId: runId,
        currency: String(conn.currency || 'ZAR'),
        autoMatch: true,
        autoMatchMinConfidence: 90,
      });

      await finishSyncRun(runId, ingest);

      await supabase
        .from('bank_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          last_error: ingest.error_message || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);

      results.push({
        connectionId: conn.id,
        companyId,
        inserted: ingest.inserted,
        duplicates: ingest.duplicates,
        auto_matched: ingest.auto_matched || 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'sync failed';
      results.push({ connectionId: conn.id, error: msg });
      await supabase
        .from('bank_connections')
        .update({
          last_error: msg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);
    }
  }

  return NextResponse.json({
    success: true,
    mode: cfg.mode,
    connections: (connections || []).length,
    results,
  });
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}
