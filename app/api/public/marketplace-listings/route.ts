import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';

/**
 * GET ?q=&category=&limit=
 * Unauthenticated public catalogue (visibility=public, status=active).
 */
export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`public-market:${ip}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limited', retryAfterSec: rl.retryAfterSec },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').toLowerCase().trim();
    const category = sp.get('category');
    const limit = Math.min(80, Math.max(1, Number(sp.get('limit') || 40)));

    const supabase = getSupabaseServer();
    let query = supabase
      .from('marketplace_listings')
      .select(
        'id, title, description, category, unit_price, currency, uom, min_order_qty, primary_image_url, seller_profile_id, visibility, status, published_at'
      )
      .eq('status', 'active')
      .or('visibility.eq.public,visibility.eq.open,visibility.is.null')
      .order('published_at', { ascending: false })
      .limit(limit * 2);

    if (category) query = query.ilike('category', category);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        listings: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_marketplace.sql',
      });
    }

    let rows = data || [];
    // Prefer explicit public; drop connected-only if column present
    rows = rows.filter((r) => {
      const v = String(r.visibility || 'public').toLowerCase();
      return v === 'public' || v === 'open' || v === '';
    });

    if (q) {
      rows = rows.filter((l) =>
        [l.title, l.category, l.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    rows = rows.slice(0, limit);

    const sellerIds = [
      ...new Set(
        rows.map((r) => Number(r.seller_profile_id)).filter((n) => n > 0)
      ),
    ];
    const sellerMap = new Map<
      number,
      {
        trading_name: string | null;
        city: string | null;
        country: string | null;
        verification_status: string | null;
      }
    >();
    if (sellerIds.length) {
      const { data: sellers } = await supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, city, country, verification_status, is_discoverable'
        )
        .in('id', sellerIds.slice(0, 40));
      for (const s of sellers || []) {
        if (s.is_discoverable === false) continue;
        sellerMap.set(Number(s.id), {
          trading_name: String(s.trading_name || s.legal_name || '') || null,
          city: s.city ? String(s.city) : null,
          country: s.country ? String(s.country) : null,
          verification_status: s.verification_status
            ? String(s.verification_status)
            : null,
        });
      }
    }

    const listings = rows.map((r) => ({
      ...r,
      seller: sellerMap.get(Number(r.seller_profile_id)) || null,
    }));

    return NextResponse.json({
      success: true,
      listings,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
