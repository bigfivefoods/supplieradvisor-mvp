import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  normalizeBankLinkTxn,
  verifyBankLinkWebhook,
  ingestCanonicalTxns,
  startSyncRun,
  finishSyncRun,
  type CanonicalTxn,
} from '@/lib/banking';

/**
 * POST /api/banking/webhooks/banklink
 *
 * BankLink Pulse destination — HTTPS webhook.
 * Configure this URL on your BankLink Pulse with optional HMAC secret
 * (BANKLINK_WEBHOOK_SECRET). Payload shapes may vary; we accept:
 *   { account_id, transactions: [...] }
 *   { data: { account_id, transactions } }
 *   { type, account, transactions }
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get('x-banklink-signature') ||
      request.headers.get('x-signature') ||
      request.headers.get('x-hub-signature-256');

    if (!verifyBankLinkWebhook(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const nested =
      typeof payload.data === 'object' && payload.data
        ? (payload.data as Record<string, unknown>)
        : payload;

    const externalAccountId = String(
      nested.account_id ||
        nested.accountId ||
        (nested.account as { id?: string } | undefined)?.id ||
        payload.account_id ||
        ''
    );

    const rawTxns = (nested.transactions ||
      nested.items ||
      payload.transactions ||
      []) as Record<string, unknown>[];

    if (!externalAccountId) {
      return NextResponse.json(
        { error: 'account_id required', received_keys: Object.keys(payload) },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: conn } = await supabase
      .from('bank_connections')
      .select('*')
      .or(
        `external_account_id.eq.${externalAccountId},external_connection_id.eq.${externalAccountId}`
      )
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!conn) {
      // Accept but no-op — connection may not be mapped yet
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: 'No active bank_connections row for this account_id',
        account_id: externalAccountId,
      });
    }

    const bankAccountId = Number(conn.bank_account_id);
    if (!Number.isFinite(bankAccountId)) {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: 'Connection not mapped to bank_account_id',
      });
    }

    const txns: CanonicalTxn[] = (Array.isArray(rawTxns) ? rawTxns : []).map((row) =>
      normalizeBankLinkTxn(row)
    );

    const runId = await startSyncRun({
      companyId: Number(conn.profile_id),
      connectionId: Number(conn.id),
      bankAccountId,
      provider: 'banklink',
      trigger: 'webhook',
    });

    const ingest = await ingestCanonicalTxns({
      companyId: Number(conn.profile_id),
      bankAccountId,
      txns,
      connectionId: Number(conn.id),
      syncRunId: runId,
      currency: String(conn.currency || 'ZAR'),
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
      ingest,
      sync_run_id: runId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Webhook error' },
      { status: 500 }
    );
  }
}

/** Health check for BankLink destination validation */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'supplieradvisor-banklink-webhook',
    path: '/api/banking/webhooks/banklink',
  });
}
