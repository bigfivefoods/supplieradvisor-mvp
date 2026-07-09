import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    const status = request.nextUrl.searchParams.get('status');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    let query = supabase
      .from('customers')
      .select('*')
      .eq('profile_id', companyId)
      .order('trading_name');
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        customers: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_crm_leads_opportunities.sql',
      });
    }

    let customers = data || [];
    if (q) {
      customers = customers.filter((c) => {
        const hay = [
          c.trading_name,
          c.legal_name,
          c.email,
          c.phone,
          c.contact_name,
          c.city,
          c.industry,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return NextResponse.json({ success: true, customers });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.trading_name) {
      return NextResponse.json({ error: 'companyId and trading_name required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const payload: Record<string, unknown> = {
      profile_id: companyId,
      trading_name: String(body.trading_name).trim(),
      legal_name: body.legal_name || null,
      email: body.email || null,
      phone: body.phone || null,
      contact_name: body.contact_name || null,
      job_title: body.job_title || null,
      status: body.status || 'active',
      customer_type: body.customer_type || 'business',
      billing_address: body.billing_address || null,
      shipping_address: body.shipping_address || null,
      credit_limit: body.credit_limit != null ? Number(body.credit_limit) : 0,
      website: body.website || null,
      industry: body.industry || null,
      vat_number: body.vat_number || null,
      registration_number: body.registration_number || null,
      city: body.city || null,
      country: body.country || null,
      region: body.region || null,
      postal_code: body.postal_code || null,
      currency: body.currency || 'ZAR',
      payment_terms: body.payment_terms || null,
      source: body.source || null,
      owner_name: body.owner_name || null,
      notes: body.notes || null,
      rating: body.rating != null ? Number(body.rating) : 0,
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase.from('customers').insert(payload).select('*').single();
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const minimal = {
        profile_id: companyId,
        trading_name: payload.trading_name,
        email: payload.email,
        phone: payload.phone,
        status: payload.status,
      };
      const retry = await supabase.from('customers').insert(minimal).select('*').single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_crm_leads_opportunities.sql' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, customer: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = [
      'trading_name',
      'legal_name',
      'email',
      'phone',
      'contact_name',
      'job_title',
      'status',
      'customer_type',
      'billing_address',
      'shipping_address',
      'credit_limit',
      'website',
      'industry',
      'vat_number',
      'registration_number',
      'city',
      'country',
      'region',
      'postal_code',
      'currency',
      'payment_terms',
      'source',
      'owner_name',
      'notes',
      'rating',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, customer: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
