import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  BANK_JOB_META_KEY,
  applyBankWebhook,
  mergeFieldMetadata,
  publicTrustFromFields,
  readFieldChecks,
  rememberWebhookEvent,
  verifyWebhookSignature,
} from '@/lib/verifynow/company-checks';

/**
 * Signed callback for Capitec Business / Mercantile bank jobs.
 * Header contract: x-verifynow-signature = v1=HMAC_SHA256(secret, timestamp + "." + rawBody)
 */
export async function POST(request: NextRequest) {
  const secret = process.env.VERIFYNOW_WEBHOOK_SECRET?.trim() || '';
  if (!secret) {
    return NextResponse.json({ error: 'VERIFYNOW_WEBHOOK_SECRET is not configured' }, { status: 503 });
  }
  const rawBody = await request.text();
  const verified = verifyWebhookSignature({
    secret,
    timestamp: request.headers.get('x-verifynow-timestamp') || '',
    rawBody,
    received: request.headers.get('x-verifynow-signature') || '',
  });
  if (!verified.ok) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const data =
    event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : {};
  const jobId = String(data.jobId || event.jobId || '').trim();
  const eventId = request.headers.get('x-verifynow-event-id') || String(event.id || '');
  if (!jobId) return NextResponse.json({ ok: true, ignored: true });

  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('profiles')
    .select('id, metadata')
    .filter(`metadata->>${BANK_JOB_META_KEY}`, 'eq', jobId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: 'Could not match the bank job' }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: 'Unknown job' }, { status: 404 });

  const profileId = Number(row.id);
  const remembered = rememberWebhookEvent(row.metadata, eventId);
  if (remembered.duplicate) return NextResponse.json({ ok: true, duplicate: true });

  const existing = readFieldChecks(row.metadata).bank_account;
  if (!existing) return NextResponse.json({ error: 'Bank check not stored' }, { status: 404 });
  const summary = applyBankWebhook(existing, event, new Date().toISOString());
  const fields = { ...readFieldChecks(remembered.metadata), bank_account: summary };
  const metadata = mergeFieldMetadata(
    remembered.metadata,
    summary,
    publicTrustFromFields(fields),
    jobId
  );
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', profileId);
  if (updateError) {
    return NextResponse.json({ error: 'Could not store the bank result' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
