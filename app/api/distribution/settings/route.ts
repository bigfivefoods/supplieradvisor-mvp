import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('distribution_settings')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({
        success: true,
        settings: {
          default_incoterm: 'DAP',
          default_mode: 'road',
          track_gps: true,
          require_pod: true,
        },
        warning: error.message,
      });
    }
    return NextResponse.json({
      success: true,
      settings: data || {
        default_incoterm: 'DAP',
        default_mode: 'road',
        track_gps: true,
        require_pod: true,
      },
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
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      default_incoterm: body.default_incoterm || 'DAP',
      default_mode: body.default_mode || 'road',
      track_gps: body.track_gps !== false,
      require_pod: body.require_pod !== false,
      metadata: body.metadata || {},
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('distribution_settings')
      .select('id')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from('distribution_settings')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, settings: data });
    }

    const { data, error } = await supabase
      .from('distribution_settings')
      .insert(payload)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, settings: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
