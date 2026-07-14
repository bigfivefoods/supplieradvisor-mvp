import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * GET ?public_id= — public supplier invite claim page (limited fields only).
 * Uses service role server-side; does not expose full profile rows to anon.
 */
export async function GET(request: NextRequest) {
  try {
    const publicId = String(
      request.nextUrl.searchParams.get('public_id') || ''
    ).trim();
    if (!publicId || publicId.length < 4) {
      return NextResponse.json({ error: 'public_id required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'public_id, trading_name, legal_name, contact_name, contact_phone, category, supplier_status'
      )
      .eq('public_id', publicId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: 'This invitation link is invalid or has expired.' },
        { status: 404 }
      );
    }
    if (String(data.supplier_status || '').toLowerCase() === 'active') {
      return NextResponse.json(
        { error: 'This supplier has already joined SupplierAdvisor.' },
        { status: 409 }
      );
    }

    // Never return email/banking on public join
    return NextResponse.json({
      success: true,
      profile: {
        public_id: data.public_id,
        trading_name: data.trading_name,
        legal_name: data.legal_name,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        category: data.category,
        supplier_status: data.supplier_status,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
