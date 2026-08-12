/**
 * Gym door QR check-in (public, token = gym public_token).
 *
 * GET  ?token=  — gym brand + whether phone check-in is open
 * POST { gym_token | token, member_token? | code? | email? | phone? }
 *      → record check-in + membership paid/unpaid status for desk
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  FITGRAPH_PUBLIC_TOKEN_KEY,
  findClientForCheckIn,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  recordMemberCheckIn,
  writeFitgraphToMetadata,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveGym(
  token: string
): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: FitgraphStore;
} | null> {
  const supabase = getSupabaseServer();
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;

  const { data: byIndex } = await supabase
    .from('profiles')
    .select('id, metadata')
    .contains('metadata', { [FITGRAPH_PUBLIC_TOKEN_KEY]: clean })
    .maybeSingle();

  if (byIndex) {
    const meta =
      byIndex.metadata && typeof byIndex.metadata === 'object'
        ? { ...(byIndex.metadata as Record<string, unknown>) }
        : {};
    const store = readFitgraphFromMetadata(meta);
    if (store.settings?.public_token === clean) {
      return { companyId: Number(byIndex.id), meta, store };
    }
  }

  const parsed = parseCompanyIdFromToken(clean);
  if (parsed != null && Number.isFinite(parsed)) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, metadata')
      .eq('id', parsed)
      .maybeSingle();
    if (prof) {
      const meta =
        prof.metadata && typeof prof.metadata === 'object'
          ? { ...(prof.metadata as Record<string, unknown>) }
          : {};
      const store = readFitgraphFromMetadata(meta);
      if (store.settings?.public_token === clean) {
        return { companyId: Number(prof.id), meta, store };
      }
    }
  }

  return null;
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: FitgraphStore
) {
  const supabase = getSupabaseServer();
  const nextMeta = writeFitgraphToMetadata(meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
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
        primary_color: s?.embed_primary_color || '#7c3aed',
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

    const resolved = await resolveGym(gymToken);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Gym check-in QR not found' },
        { status: 404 }
      );
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

    await saveStore(resolved.companyId, resolved.meta, result.store);

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
        primary_color: s?.embed_primary_color || '#7c3aed',
      },
      /** Owner sees unpaid/frozen attempts on the check-ins board */
      owner_alert: result.access.alert,
      message: result.duplicate
        ? 'Already checked in recently.'
        : result.access.member_message,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Check-in failed' },
      { status: 500 }
    );
  }
}
