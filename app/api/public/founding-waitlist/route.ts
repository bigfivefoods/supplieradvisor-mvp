import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';

/**
 * GET — remaining founding slots
 * POST { email, companyName? } — join waitlist when full
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trading_name', 'is', null);

    const used = count ?? 0;
    const remaining = Math.max(0, FOUNDING_FREE_COMPANY_LIMIT - used);

    return NextResponse.json({
      success: true,
      limit: FOUNDING_FREE_COMPANY_LIMIT,
      used,
      remaining,
      full: remaining <= 0,
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
    const body = await request.json();
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trading_name', 'is', null);

    const remaining = Math.max(0, FOUNDING_FREE_COMPANY_LIMIT - (count ?? 0));

    const { error } = await supabase.from('founding_waitlist').upsert(
      {
        email,
        company_name: body.companyName
          ? String(body.companyName).slice(0, 200)
          : null,
        user_id: body.userId ? String(body.userId) : null,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
        status: remaining > 0 ? 'slots_available' : 'waiting',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    // unique index is on lower(email) — upsert may need insert only
    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260716_platform_improvements.sql',
          },
          { status: 503 }
        );
      }
      // try plain insert ignore duplicate
      if (/duplicate|unique/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          alreadyOnList: true,
          remaining,
          full: remaining <= 0,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      remaining,
      full: remaining <= 0,
      message:
        remaining <= 0
          ? 'You are on the founding waitlist. We will contact you when access options open.'
          : 'Founding slots are still available — register your company now.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
