import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * POST { public_id, contact_name, contact_phone, password }
 * Completes supplier join claim via service role (no direct client table writes).
 *
 * Note: Primary platform auth is Privy. This legacy join flow updates the
 * profile claim fields; user should continue with Privy login after claim.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const publicId = String(body.public_id || '').trim();
    const contactName = String(body.contact_name || '').trim();
    const contactPhone = String(body.contact_phone || '').trim();
    const password = String(body.password || '');

    if (!publicId) {
      return NextResponse.json({ error: 'public_id required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const rl = checkRateLimit({
      key: `join-claim:${request.headers.get('x-forwarded-for') || 'ip'}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const supabase = getSupabaseServer();
    const { data: profile, error: findErr } = await supabase
      .from('profiles')
      .select('id, public_id, trading_name, supplier_status, email')
      .eq('public_id', publicId)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json(
        { error: 'This invitation link is invalid or has expired.' },
        { status: 404 }
      );
    }
    if (String(profile.supplier_status || '').toLowerCase() === 'active') {
      return NextResponse.json(
        { error: 'This supplier has already joined SupplierAdvisor.' },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        supplier_status: 'active',
        claimed_at: new Date().toISOString(),
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .eq('public_id', publicId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Optional: create auth user if email present and admin client available
    // Primary product login is Privy — claim only activates the profile.
    return NextResponse.json({
      success: true,
      message: 'Profile claimed. Continue with SupplierAdvisor login.',
      trading_name: profile.trading_name,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
