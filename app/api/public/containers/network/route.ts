import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { buildPublicNetworkPayload } from '@/lib/containers/public-share';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET ?token= — public container network (map pins + metrics) for website embed.
 * No auth. Sanitised fields only.
 */
export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Valid token required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: share, error: shareErr } = await supabase
      .from('container_network_shares')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (shareErr) {
      if (/does not exist|schema cache/i.test(shareErr.message)) {
        return NextResponse.json(
          {
            error: 'Share not configured',
            hint: 'Run 20260712_container_network_share.sql',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: shareErr.message }, { status: 500 });
    }
    if (!share) {
      return NextResponse.json({ error: 'Share link not found or inactive' }, { status: 404 });
    }

    const profileId = Number(share.profile_id);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .eq('id', profileId)
      .maybeSingle();

    const companyName =
      profile?.trading_name ||
      profile?.legal_name ||
      share.brand_name ||
      'Container network';

    const { data: containers, error: cErr } = await supabase
      .from('containers')
      .select(
        'id, container_code, name, status, city, province, country, latitude, longitude, assigned_contractor, photo_url, is_active'
      )
      .eq('profile_id', profileId)
      .order('name', { ascending: true });

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    // Exclude clearly inactive if flag present
    const rows = (containers || []).filter((c) => c.is_active !== false);

    const payload = buildPublicNetworkPayload({
      companyName: String(companyName),
      title: share.title,
      brandName: share.brand_name,
      brandUrl: share.brand_url,
      showMetrics: share.show_metrics !== false,
      showList: share.show_list !== false,
      showContractors: Boolean(share.show_contractors),
      showPhotos: Boolean(share.show_photos),
      containers: rows as Array<Record<string, unknown>>,
    });

    const res = NextResponse.json({ success: true, network: payload });
    // Allow embedding on partner sites
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );
    return res;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
