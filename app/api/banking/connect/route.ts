import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import {
  banklinkConfig,
  createBankLinkSession,
  fetchBankLinkTransactions,
  ingestCanonicalTxns,
  startSyncRun,
  finishSyncRun,
  sandboxTransactions,
} from '@/lib/banking';

/**
 * POST — start bank link or complete sandbox callback
 *
 * action: 'start' | 'complete' | 'sync_demo'
 *
 * start: creates bank_connections row + returns hosted link URL
 * complete: marks connection active (sandbox loads demo txns)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const action = String(body.action || 'start');
    const bankAccountId = body.bank_account_id ? Number(body.bank_account_id) : null;
    const returnUrl =
      String(body.returnUrl || '') ||
      'https://www.supplieradvisor.com/dashboard/accounting/bank-reconciliation';

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const cfg = banklinkConfig();

    if (action === 'start') {
      if (bankAccountId) {
        const { data: bank } = await supabase
          .from('bank_accounts')
          .select('id')
          .eq('id', bankAccountId)
          .eq('profile_id', companyId)
          .maybeSingle();
        if (!bank) {
          return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
        }
      }

      const session = await createBankLinkSession({
        companyId,
        returnUrl,
        bankAccountId,
      });

      const { data: conn, error } = await supabase
        .from('bank_connections')
        .insert({
          profile_id: companyId,
          bank_account_id: bankAccountId,
          provider: session.mode === 'sandbox' ? 'sandbox' : 'banklink',
          status: 'pending',
          bank_name: 'FNB',
          link_session_id: session.sessionId,
          created_by: privyUserId || null,
          metadata: {
            returnUrl,
            mode: session.mode,
            message: session.message || null,
          },
        })
        .select('*')
        .single();

      if (error || !conn) {
        return NextResponse.json(
          {
            error: error?.message || 'Failed to create connection',
            hint: 'Run supabase/migrations/20260711_bank_middleware.sql',
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        connection: conn,
        url: session.url,
        sessionId: session.sessionId,
        mode: session.mode,
        message: session.message,
        provider: {
          configured: cfg.configured,
          mode: cfg.mode,
        },
      });
    }

    if (action === 'complete' || action === 'sync_demo') {
      const sessionId = String(body.sessionId || body.session || '');
      const connectionId = body.connectionId ? Number(body.connectionId) : null;

      let connQuery = supabase.from('bank_connections').select('*').eq('profile_id', companyId);
      if (connectionId) connQuery = connQuery.eq('id', connectionId);
      else if (sessionId) connQuery = connQuery.eq('link_session_id', sessionId);
      else {
        return NextResponse.json(
          { error: 'connectionId or sessionId required' },
          { status: 400 }
        );
      }

      const { data: conn, error: cErr } = await connQuery.maybeSingle();
      if (cErr || !conn) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      }

      // Ensure a bank account exists to land transactions
      let targetAccountId = conn.bank_account_id as number | null;
      if (!targetAccountId) {
        const { data: existing } = await supabase
          .from('bank_accounts')
          .select('id')
          .eq('profile_id', companyId)
          .ilike('bank_name', '%FNB%')
          .limit(1)
          .maybeSingle();
        if (existing) {
          targetAccountId = existing.id;
        } else {
          const { data: created } = await supabase
            .from('bank_accounts')
            .insert({
              profile_id: companyId,
              name: 'FNB Business (linked)',
              bank_name: 'FNB',
              account_type: 'current',
              currency: 'ZAR',
              provider: conn.provider === 'sandbox' ? 'sandbox' : 'banklink',
              feed_provider: conn.provider,
              status: 'active',
            })
            .select('id')
            .single();
          targetAccountId = created?.id ?? null;
        }
      }

      if (!targetAccountId) {
        return NextResponse.json(
          { error: 'Could not resolve bank account for connection' },
          { status: 400 }
        );
      }

      const externalAccountId =
        String(body.external_account_id || conn.external_account_id || 'sandbox-fnb-001');

      await supabase
        .from('bank_connections')
        .update({
          status: 'active',
          bank_account_id: targetAccountId,
          external_connection_id: externalAccountId,
          external_account_id: externalAccountId,
          bank_name: 'FNB',
          account_name: 'Business Current',
          account_mask: '4521',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);

      await supabase
        .from('bank_accounts')
        .update({
          connection_id: conn.id,
          feed_provider: conn.provider,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetAccountId);

      // Pull transactions (sandbox demo or live)
      let txns = sandboxTransactions();
      if (conn.provider === 'banklink' && cfg.mode === 'live') {
        const pulled = await fetchBankLinkTransactions({ accountId: externalAccountId });
        if (pulled.txns.length) txns = pulled.txns;
      }

      const runId = await startSyncRun({
        companyId,
        connectionId: conn.id,
        bankAccountId: targetAccountId,
        provider: conn.provider || 'sandbox',
        trigger: 'link_complete',
      });

      const ingest = await ingestCanonicalTxns({
        companyId,
        bankAccountId: targetAccountId,
        txns,
        connectionId: conn.id,
        syncRunId: runId,
        currency: 'ZAR',
        privyUserId,
      });

      await finishSyncRun(runId, ingest);

      await supabase
        .from('bank_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);

      return NextResponse.json({
        success: true,
        connectionId: conn.id,
        bank_account_id: targetAccountId,
        mode: cfg.mode,
        ingest,
        message:
          cfg.mode === 'sandbox'
            ? 'Sandbox FNB feed connected with sample transactions. Set BANKLINK_API_KEY for live BankLink.'
            : 'Bank connection active and transactions synced.',
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
