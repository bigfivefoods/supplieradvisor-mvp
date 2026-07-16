import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { buildPublicNetworkPayload } from '@/lib/containers/public-share';
import {
  aggregateSalesByContainer,
  computeContainerImpact,
  normalizeSettings,
  sumImpact,
  type ImpactSettings,
} from '@/lib/containers/impact';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET ?token= — public container network (map pins + metrics + impact) for website embed.
 * No auth. Sanitised fields only (no sales revenue on public payload).
 */
export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-containers:${ip}`,
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

    // Soft view counter (never block payload on analytics failure)
    void (async () => {
      try {
        const views = Number((share as { view_count?: number }).view_count || 0) + 1;
        const { error: viewErr } = await supabase
          .from('container_network_shares')
          .update({
            view_count: views,
            last_viewed_at: new Date().toISOString(),
          })
          .eq('id', share.id);
        if (viewErr && /column|does not exist/i.test(viewErr.message)) {
          /* run 20260716_container_share_views.sql */
        }
      } catch {
        /* optional */
      }
    })();

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

    const baseSelect =
      'id, container_code, name, status, city, province, country, latitude, longitude, assigned_contractor, contractor_id, photo_url, is_active';
    const impactSelect = `${baseSelect}, impact_jobs_direct, impact_jobs_support, impact_people_per_sale, impact_avg_meal_price`;

    let containers: Array<Record<string, unknown>> = [];
    {
      const withImpact = await supabase
        .from('containers')
        .select(impactSelect)
        .eq('profile_id', profileId)
        .order('name', { ascending: true });

      if (
        withImpact.error &&
        /does not exist|schema cache|column/i.test(withImpact.error.message)
      ) {
        const base = await supabase
          .from('containers')
          .select(baseSelect)
          .eq('profile_id', profileId)
          .order('name', { ascending: true });
        if (base.error) {
          return NextResponse.json({ error: base.error.message }, { status: 500 });
        }
        containers = (base.data || []) as Array<Record<string, unknown>>;
      } else if (withImpact.error) {
        return NextResponse.json(
          { error: withImpact.error.message },
          { status: 500 }
        );
      } else {
        containers = (withImpact.data || []) as Array<Record<string, unknown>>;
      }
    }

    // Exclude clearly inactive if flag present
    const rows = containers.filter((c) => c.is_active !== false);

    // Rolling 12 months for people-fed story
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 1);
    const from = fromDate.toISOString().slice(0, 10);

    const [salesRes, settingsRes] = await Promise.all([
      supabase
        .from('container_sales')
        .select('id, container_id, gross_amount, net_amount, sale_date, items')
        .eq('profile_id', profileId)
        .gte('sale_date', from)
        .lte('sale_date', to)
        .limit(10000),
      supabase
        .from('container_impact_settings')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle(),
    ]);

    const settings = normalizeSettings(
      settingsRes.data as Partial<ImpactSettings> | null
    );
    const salesMissing = Boolean(
      salesRes.error &&
        /does not exist|schema cache/i.test(salesRes.error.message)
    );
    const salesByContainer = salesMissing
      ? new Map()
      : aggregateSalesByContainer(
          (salesRes.data || []) as Array<Record<string, unknown>>
        );

    const impactRows = rows.map((c) =>
      computeContainerImpact(
        c as Parameters<typeof computeContainerImpact>[0],
        salesByContainer.get(Number(c.id)),
        settings
      )
    );
    const totals = sumImpact(impactRows);
    const impactByContainer = new Map(
      impactRows.map((r) => [
        r.container_id,
        {
          people_fed: r.people_fed,
          jobs_total: r.jobs_total,
          jobs_direct: r.jobs_direct,
          jobs_support: r.jobs_support,
          staffed: r.staffed,
        },
      ])
    );

    // show_impact column optional — default on when metrics on
    const showImpact =
      share.show_impact != null
        ? Boolean(share.show_impact)
        : share.show_metrics !== false;

    const payload = buildPublicNetworkPayload({
      companyName: String(companyName),
      title: share.title,
      brandName: share.brand_name,
      brandUrl: share.brand_url,
      showMetrics: share.show_metrics !== false,
      showList: share.show_list !== false,
      showContractors: Boolean(share.show_contractors),
      showPhotos: Boolean(share.show_photos),
      showImpact,
      containers: rows,
      impactByContainer,
      impactTotals: {
        people_fed: totals.people_fed,
        jobs_total: totals.jobs_total,
        jobs_direct: totals.jobs_direct,
        jobs_support: totals.jobs_support,
        staffed: totals.staffed,
        containers: totals.containers,
      },
      impactPeriod: { from, to },
      methodology: settings.methodology_notes,
    });

    const res = NextResponse.json({ success: true, network: payload });
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
