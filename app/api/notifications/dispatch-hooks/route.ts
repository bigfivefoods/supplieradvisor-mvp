import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret } from '@/lib/auth/api-auth';

/**
 * POST — cron/internal hook to enqueue high-value notifications.
 * Body: { type, companyId, payload }
 * Types: connection_request | po_received | invoice_overdue | verification_failed | verifynow_low_credits
 *
 * Persists to activity_log + optional notifications table if present.
 * Auth: CRON_SECRET bearer.
 */
export async function POST(request: NextRequest) {
  const cron = assertCronSecret(request);
  if (!cron.ok) return cron.response;

  try {
    const body = await request.json();
    const type = String(body.type || '').trim();
    const companyId = Number(body.companyId);
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

    if (!type || !Number.isFinite(companyId)) {
      return NextResponse.json(
        { error: 'type and companyId required' },
        { status: 400 }
      );
    }

    const allowed = new Set([
      'connection_request',
      'po_received',
      'invoice_overdue',
      'verification_failed',
      'verifynow_low_credits',
    ]);
    if (!allowed.has(type)) {
      return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
    }

    const summaries: Record<string, string> = {
      connection_request: 'New connection request awaiting response',
      po_received: 'New purchase order received',
      invoice_overdue: 'Invoice overdue — follow up',
      verification_failed: 'Identity or bank verification failed',
      verifynow_low_credits: 'VerifyNow credits running low',
    };

    const supabase = getSupabaseServer();
    await supabase.from('activity_log').insert({
      profile_id: companyId,
      actor_user_id: 'system:notifications',
      action: `notify.${type}`,
      entity_type: 'notifications',
      entity_id: type,
      summary: summaries[type] || type,
      metadata: { ...payload, channel: 'activity+push_optional' },
    });

    // Best-effort insert into notifications table if it exists
    const { error: nErr } = await supabase.from('notifications').insert({
      profile_id: companyId,
      type,
      title: summaries[type],
      body: String((payload as { message?: string }).message || summaries[type]),
      metadata: payload,
      read: false,
    });

    return NextResponse.json({
      success: true,
      type,
      companyId,
      notificationsTable: !nErr,
      warning: nErr?.message,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
