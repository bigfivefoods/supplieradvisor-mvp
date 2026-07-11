import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
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
 * POST — pull latest transactions for a connection or bank account
 * body: companyId, privyUserId, connectionId? | bank_account_id?
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const connectionId = body.connectionId ? Number(body.connectionId) : null;
    const bankAccountId = body.bank_account_id ? Number(body.bank_account_id) : null;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const cfg = banklinkConfig();

    let conn: Record<string, unknown> | null = null;
    if (connectionId) {
      const { data } = await supabase
        .from('bank_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('profile_id', companyId)
        .maybeSingle();
      conn = data;
    } else if (bankAccountId) {
      const { data } = await supabase
        .from('bank_connections')
        .select('*')
        .eq('profile_id', companyId)
        .eq('bank_account_id', bankAccountId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      conn = data;
    } else {
      const { data } = await supabase
        .from('bank_connections')
        .select('*')
        .eq('profile_id', companyId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      conn = data;
    }

    if (!conn) {
      return NextResponse.json(
        {
          error: 'No active bank connection. Use Connect bank first.',
        },
        { status: 404 }
      );
    }

    const targetAccountId = Number(conn.bank_account_id || bankAccountId);
    if (!Number.isFinite(targetAccountId)) {
      return NextResponse.json(
        { error: 'Connection is not mapped to a bank account' },
        { status: 400 }
      );
    }

    const externalAccountId = String(
      conn.external_account_id || conn.external_connection_id || ''
    );

    if (conn.provider === 'banklink' && cfg.mode === 'live' && externalAccountId) {
      await triggerBankLinkSync(externalAccountId);
    }

    let txns =
      conn.provider === 'sandbox' || cfg.mode === 'sandbox'
        ? sandboxTransactions()
        : [];

    if (conn.provider === 'banklink' && cfg.mode === 'live' && externalAccountId) {
      const pulled = await fetchBankLinkTransactions({ accountId: externalAccountId });
      if (pulled.error && !pulled.txns.length) {
        return NextResponse.json(
          { error: pulled.error || 'Failed to fetch transactions' },
          { status: 502 }
        );
      }
      txns = pulled.txns;
    }

    if (!txns.length && (conn.provider === 'sandbox' || cfg.mode === 'sandbox')) {
      txns = sandboxTransactions();
    }

    const runId = await startSyncRun({
      companyId,
      connectionId: Number(conn.id),
      bankAccountId: targetAccountId,
      provider: String(conn.provider || 'banklink'),
      trigger: 'manual',
    });

    const ingest = await ingestCanonicalTxns({
      companyId,
      bankAccountId: targetAccountId,
      txns,
      connectionId: Number(conn.id),
      syncRunId: runId,
      currency: String(conn.currency || 'ZAR'),
      privyUserId,
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

    return NextResponse.json({
      success: true,
      connectionId: conn.id,
      bank_account_id: targetAccountId,
      mode: cfg.mode,
      ingest,
      sync_run_id: runId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
