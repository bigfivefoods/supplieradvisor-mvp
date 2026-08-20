/**
 * Garmin Activity ping — look up the connected member and pull new activities.
 * Register this URL in the Garmin Connect Developer Program:
 *   https://www.supplieradvisor.com/api/public/fitgraph/garmin/webhook
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import { saveAdvisorModuleStore } from '@/lib/business/company-data';
import {
  applyWatchSessionToStore,
  ensureGarminAccess,
  garminActivityToWatchInput,
  garminRedirectUri,
  matchWatchToSession,
  pullGarminActivities,
} from '@/lib/fitness/wearables';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, service: 'garmin-webhook' });
}

function garminWebhookAuthorized(req: NextRequest): boolean {
  const secret = String(process.env.GARMIN_WEBHOOK_SECRET || '').trim();
  const prod =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  if (!secret) return !prod;
  const got =
    req.headers.get('x-garmin-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  if (got.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!garminWebhookAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: true });
  }
  const userId = String(
    body.userId || body.user_id || (body as { user?: { userId?: string } }).user?.userId || ''
  ).trim();
  if (!userId) return NextResponse.json({ ok: true, ignored: true });

  const startSec = Number(
    body.uploadStartTimeInSeconds || body.startTimeInSeconds || 0
  );
  const endSec = Number(
    body.uploadEndTimeInSeconds || body.endTimeInSeconds || 0
  );
  const from = Number.isFinite(startSec) && startSec > 0 ? startSec : Math.floor(Date.now() / 1000) - 36 * 3600;
  const to =
    Number.isFinite(endSec) && endSec > from
      ? endSec
      : Math.floor(Date.now() / 1000);

  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('company_module_stores')
    .select('company_id, data')
    .eq('module', 'fitgraph')
    .order('updated_at', { ascending: false })
    .limit(200);

  const origin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const redirectUri = garminRedirectUri(origin);

  for (const row of rows || []) {
    const store = readFitgraphFromMetadata({ fitgraph: row.data });
    const ci = store.clients.findIndex(
      (c) => c.wearable?.garmin?.user_id === userId && c.active !== false
    );
    if (ci < 0) continue;
    const garmin0 = store.clients[ci].wearable?.garmin;
    if (!garmin0?.access_token) continue;
    try {
      const garmin = await ensureGarminAccess(garmin0, redirectUri);
      const activities = await pullGarminActivities(
        String(garmin.access_token),
        from,
        to
      );
      for (const act of activities) {
        const input = garminActivityToWatchInput(store.clients[ci].id, act);
        if (!input) continue;
        const matched = matchWatchToSession(
          store,
          store.clients[ci].id,
          input.started_at,
          input.duration_min
        );
        applyWatchSessionToStore(store, {
          ...input,
          session_id: matched.session_id,
          booking_id: matched.booking_id,
        });
      }
      store.clients[ci] = {
        ...store.clients[ci],
        wearable: {
          ...(store.clients[ci].wearable || {}),
          garmin: {
            ...garmin,
            last_sync_at: new Date().toISOString(),
          },
        },
      };
      await saveAdvisorModuleStore(
        Number(row.company_id),
        'fitgraph',
        store,
        writeFitgraphToMetadata
      );
    } catch {
      /* one company fail should not 500 the webhook */
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, unmatched: true });
}
