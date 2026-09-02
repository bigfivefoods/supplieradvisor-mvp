/**
 * Gym door QR check-in (public, token = gym public_token).
 *
 * GET  ?token=  — gym brand + whether phone check-in is open
 * POST { gym_token | token, member_token? | code? | email? | phone? }
 *      → record check-in + membership paid/unpaid status for desk
 */
import { NextRequest, NextResponse } from 'next/server';
import { isStaleModuleStoreError } from '@/lib/business/company-data';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import {
  FITGRAPH_PUBLIC_TOKEN_KEY,
  findClientForCheckIn,
  parseCompanyIdFromToken,
  gymBrandColor,
  readFitgraphFromMetadata,
  recordMemberCheckIn,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveGym(
  token: string,
  opts?: { fresh?: boolean }
): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: FitgraphStore;
} | null> {
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;
  const loaded = await loadAdvisorStoreForPublicToken({
    token: clean,
    moduleKey: 'fitgraph',
    read: readFitgraphFromMetadata,
    parseCompanyId: parseCompanyIdFromToken,
    indexKeys: [FITGRAPH_PUBLIC_TOKEN_KEY],
    fresh: opts?.fresh,
  });
  if (!loaded || loaded.store.settings?.public_token !== clean) return null;
  return loaded;
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: FitgraphStore,
  ...keys: Array<keyof FitgraphStore>
): Promise<string> {
  const patch = {} as Partial<FitgraphStore>;
  for (const key of keys) patch[key] = store[key];
  const ifUpdatedAtRaw = meta.__if_updated_at;
  const ifUpdatedAt =
    typeof ifUpdatedAtRaw === 'string' && ifUpdatedAtRaw.trim()
      ? ifUpdatedAtRaw.trim()
      : null;
  const { saveFitgraphPatch } = await import('@/lib/fitness/fitgraph-io');
  const updatedAt = await saveFitgraphPatch(companyId, patch, { ifUpdatedAt });
  store.updated_at = updatedAt;
  return updatedAt;
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-fit-checkin-get:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const token = String(
      request.nextUrl.searchParams.get('token') ||
        request.nextUrl.searchParams.get('gym_token') ||
        ''
    ).trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const resolved = await resolveGym(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Gym check-in QR not found' },
        { status: 404 }
      );
    }

    const s = resolved.store.settings;
    return NextResponse.json({
      success: true,
      companyId: resolved.companyId,
      gym: {
        brand: s?.brand_name || 'Gym',
        bio: s?.public_bio || null,
        contact_phone: s?.contact_phone || null,
        contact_email: s?.contact_email || null,
        primary_color: gymBrandColor(s?.embed_primary_color),
        timezone: s?.timezone || 'Africa/Johannesburg',
        /** Unique gym public token (QR identity) */
        public_token: s?.public_token,
        allow_public_booking: s?.allow_public_booking !== false,
        website_enabled: s?.enabled === true,
      },
      message:
        'Scan complete. Identify yourself with your member portal link, phone, email, or member code to check in.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-fit-checkin-post:${ip}`,
      limit: 40,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const gymToken = String(
      body.gym_token || body.token || body.public_token || ''
    ).trim();
    if (!gymToken) {
      return NextResponse.json(
        { error: 'gym_token required (scan the gym QR)' },
        { status: 400 }
      );
    }

    const resolved = await resolveGym(gymToken, { fresh: true });
    if (!resolved) {
      return NextResponse.json(
        { error: 'Gym check-in QR not found' },
        { status: 404 }
      );
    }
    const payloadUpdatedAt =
      typeof body.updated_at === 'string' && body.updated_at.trim()
        ? body.updated_at.trim()
        : typeof body.if_updated_at === 'string' && body.if_updated_at.trim()
          ? body.if_updated_at.trim()
          : null;
    if (payloadUpdatedAt) {
      resolved.meta.__if_updated_at = payloadUpdatedAt;
    }

    const client = findClientForCheckIn(resolved.store, {
      member_token: body.member_token || body.portal_token,
      code: body.code || body.member_code,
      email: body.email,
      phone: body.phone,
    });

    if (!client) {
      return NextResponse.json(
        {
          error:
            'Member not found. Use your member portal link, or enter the phone / email / member code on file.',
        },
        { status: 404 }
      );
    }

    const result = recordMemberCheckIn(resolved.store, client, {
      method: 'qr_phone',
      session_id: body.session_id || null,
      notes: body.notes ? String(body.notes) : undefined,
    });

    await saveStore(resolved.companyId, resolved.meta, result.store, 'check_ins');

    const s = result.store.settings;
    return NextResponse.json({
      success: true,
      denied: result.denied,
      duplicate: result.duplicate,
      check_in: {
        id: result.check_in.id,
        date: result.check_in.date,
        time: result.check_in.time,
        method: result.check_in.method,
        payment_ok: result.check_in.payment_ok,
        access_level: result.check_in.access_level,
        access_alert: result.check_in.access_alert,
      },
      access: result.access,
      member: {
        id: client.id,
        code: client.code,
        name: client.name,
        photo_url: client.photo_url || null,
      },
      gym: {
        brand: s?.brand_name || 'Gym',
        primary_color: gymBrandColor(s?.embed_primary_color),
      },
      /** Owner sees unpaid/frozen attempts on the check-ins board */
      owner_alert: result.access.alert,
      message: result.duplicate
        ? 'Already checked in recently.'
        : result.access.member_message,
    });
  } catch (e: unknown) {
    if (isStaleModuleStoreError(e)) {
      return NextResponse.json(
        {
          error: 'stale_store',
          updated_at: e.updatedAt,
          message: 'This GymAdvisor book changed in another tab. Refresh and try again.',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Check-in failed' },
      { status: 500 }
    );
  }
}
