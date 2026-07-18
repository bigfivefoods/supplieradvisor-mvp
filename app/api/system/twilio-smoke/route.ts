import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import {
  isTwilioWhatsAppConfigured,
  sendWhatsApp,
  twilioConfigStatus,
} from '@/lib/notifications/twilio-whatsapp';

/**
 * GET/POST /api/system/twilio-smoke
 * Auth: CRON_SECRET (Bearer or x-cron-secret).
 * GET  — config status only
 * POST { to?: string } — send a one-line test WhatsApp if configured
 */
export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return NextResponse.json({
    ok: true,
    configured: isTwilioWhatsAppConfigured(),
    status: twilioConfigStatus(),
    hint: isTwilioWhatsAppConfigured()
      ? 'POST with { "to": "whatsapp:+27…" } to send a test message'
      : 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM on Vercel Production, redeploy',
    docs: 'docs/alerts-whatsapp.md',
    at: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;

  const status = twilioConfigStatus();
  if (!status.configured) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Twilio WhatsApp not configured',
        status,
        fix: [
          'Vercel → Project → Settings → Environment Variables (Production)',
          'TWILIO_ACCOUNT_SID=ACxxxxxxxx',
          'TWILIO_AUTH_TOKEN=…',
          'TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  (sandbox) or your approved sender',
          'TWILIO_WHATSAPP_TO_DEFAULT=whatsapp:+27…  (optional test inbox)',
          'Redeploy production',
        ],
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const to =
    String(body.to || process.env.TWILIO_WHATSAPP_TO_DEFAULT || '').trim() ||
    null;
  if (!to) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Provide body.to = whatsapp:+27… or set TWILIO_WHATSAPP_TO_DEFAULT',
        status,
      },
      { status: 400 }
    );
  }

  const result = await sendWhatsApp({
    to: [to],
    body: `SupplierAdvisor Twilio smoke OK · ${new Date().toISOString().slice(0, 19)}Z · settle/claims alerts will use this channel.`,
  });

  return NextResponse.json({
    ok: result.ok,
    sent: result.sent,
    error: result.error,
    to,
    status,
    at: new Date().toISOString(),
  });
}
