import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';

/** Public product lookup by QR public_id — no auth */
export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`public-product:${ip}`, {
      limit: 90,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSec: rl.retryAfterSec },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const publicId = request.nextUrl.searchParams.get('publicId');
    if (!publicId) {
      return NextResponse.json({ error: 'publicId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('products')
      .select(
        'name, sku, category, uom, short_description, status, primary_image_url, specs_sheet_url, specs_sheet_name, onchain_status, onchain_hash, onchain_chain, onchain_tx_hash, public_id'
      )
      .eq('public_id', publicId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (data.status && data.status !== 'active') {
      return NextResponse.json({ error: 'Product not available' }, { status: 404 });
    }
    return NextResponse.json({ success: true, product: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
