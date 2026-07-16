import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { logApi } from '@/lib/logging/logger';

/**
 * POST — cron/internal hook to enqueue high-value notifications.
 * Body: { type, companyId, payload }
 * Types: connection_request | po_received | invoice_overdue | verification_failed | verifynow_low_credits
 *
 * Persists to activity_log + optional notifications table,
 * then emails (+ best-effort push) via lib/notifications/email-alerts.
 * Auth: CRON_SECRET bearer.
 */
export async function POST(request: NextRequest) {
  const cron = assertCronSecret(request);
  if (!cron.ok) return cron.response;

  try {
    const body = await request.json();
    const type = String(body.type || '').trim();
    const companyId = Number(body.companyId);
    const payload =
      body.payload && typeof body.payload === 'object' ? body.payload : {};

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
      return NextResponse.json(
        { error: 'Unknown notification type' },
        { status: 400 }
      );
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
      metadata: { ...payload, channel: 'activity+email+push' },
    });

    const { error: nErr } = await supabase.from('notifications').insert({
      profile_id: companyId,
      type,
      title: summaries[type],
      body: String(
        (payload as { message?: string }).message || summaries[type]
      ),
      metadata: payload,
      read: false,
    });

    // Email + optional push
    let emailOk = false;
    let emailError: string | undefined;
    try {
      const alerts = await import('@/lib/notifications/email-alerts');
      const p = payload as Record<string, unknown>;
      if (type === 'connection_request') {
        await alerts.notifyConnectionRequest({
          requesteeProfileId: companyId,
          requesterName: (p.requesterName as string) || null,
          requesterProfileId: p.requesterProfileId
            ? Number(p.requesterProfileId)
            : null,
          message: (p.message as string) || null,
        });
        emailOk = true;
      } else if (type === 'po_received') {
        await alerts.notifyInboundPo({
          supplierProfileId: companyId,
          buyerProfileId: Number(p.buyerProfileId || 0),
          buyerName: (p.buyerName as string) || null,
          poId: Number(p.poId || 0),
          totalAmount:
            p.totalAmount != null ? Number(p.totalAmount) : null,
          currency: (p.currency as string) || null,
          lineCount: p.lineCount != null ? Number(p.lineCount) : undefined,
          source: (p.source as string) || null,
        });
        emailOk = true;
        try {
          const { notifyInboundPoPush } = await import('@/lib/push/web-push');
          await notifyInboundPoPush({
            supplierProfileId: companyId,
            buyerName: (p.buyerName as string) || null,
            poId: Number(p.poId || 0),
          });
        } catch {
          /* push optional */
        }
      } else if (type === 'invoice_overdue') {
        await alerts.notifyInvoiceOverdue({
          profileId: companyId,
          invoiceId: Number(p.invoiceId || 0),
          invoiceNumber: (p.invoiceNumber as string) || null,
          customerName: (p.customerName as string) || null,
          amount: p.amount != null ? Number(p.amount) : null,
          currency: (p.currency as string) || null,
        });
        emailOk = true;
      } else if (type === 'verification_failed') {
        await alerts.notifyVerificationFailed({
          profileId: companyId,
          kind: String(p.kind || 'identity'),
          detail: (p.detail as string) || null,
        });
        emailOk = true;
      } else if (type === 'verifynow_low_credits') {
        await alerts.notifyVerifynowLowCredits({
          profileId: companyId,
          remainingCredits:
            p.remainingCredits != null ? Number(p.remainingCredits) : null,
        });
        emailOk = true;
      }
    } catch (e: unknown) {
      emailError = e instanceof Error ? e.message : 'email failed';
      logApi('/api/notifications/dispatch-hooks', 'warn', 'email dispatch soft-fail', {
        type,
        companyId,
        err: emailError,
      });
    }

    logApi('/api/notifications/dispatch-hooks', 'info', 'dispatched', {
      type,
      companyId,
      emailOk,
    });

    return NextResponse.json({
      success: true,
      type,
      companyId,
      notificationsTable: !nErr,
      emailOk,
      emailError,
      warning: nErr?.message,
    });
  } catch (e: unknown) {
    logApi('/api/notifications/dispatch-hooks', 'error', 'dispatch failed', {
      err: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
