import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const status = request.nextUrl.searchParams.get('status');
    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    let query = supabase
      .from('leads')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(500);
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        leads: [],
        warning: error.message,
        hint: 'Run 20260709_crm_leads_opportunities.sql',
      });
    }

    let leads = data || [];
    if (q) {
      leads = leads.filter((l) => {
        const hay = [l.name, l.company_name, l.email, l.phone, l.source, l.city, l.industry]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return NextResponse.json({ success: true, leads });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.name) {
      return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      profile_id: companyId,
      name: String(body.name).trim(),
      company_name: body.company_name || null,
      email: body.email || null,
      phone: body.phone || null,
      job_title: body.job_title || null,
      website: body.website || null,
      status: body.status || 'new',
      source: body.source || null,
      source_detail: body.source_detail || null,
      industry: body.industry || null,
      city: body.city || null,
      region: body.region || null,
      country: body.country || null,
      address: body.address || null,
      value_estimate: body.value_estimate != null ? Number(body.value_estimate) : 0,
      currency: body.currency || 'ZAR',
      score: body.score != null ? Number(body.score) : 0,
      priority: body.priority || 'medium',
      owner_name: body.owner_name || null,
      next_action: body.next_action || null,
      next_action_date: body.next_action_date || null,
      notes: body.notes || null,
      product_interest: body.product_interest || null,
      last_contacted_at: body.last_contacted_at || null,
      sales_rep_user_id: body.sales_rep_user_id || body.privyUserId || null,
      updated_at: now,
    };

    let { data, error } = await supabase.from('leads').insert(payload).select('*').single();
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const minimal = {
        profile_id: companyId,
        name: payload.name,
        company_name: payload.company_name,
        email: payload.email,
        phone: payload.phone,
        status: payload.status,
        source: payload.source,
        value_estimate: payload.value_estimate,
        notes: payload.notes,
      };
      const retry = await supabase.from('leads').insert(minimal).select('*').single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_crm_leads_opportunities.sql' },
        { status: 500 }
      );
    }

    await supabase.from('crm_activities').insert({
      profile_id: companyId,
      entity_type: 'lead',
      entity_id: data.id,
      activity_type: 'note',
      subject: 'Lead created',
      body: body.notes || null,
    });

    return NextResponse.json({ success: true, lead: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = [
      'name',
      'company_name',
      'email',
      'phone',
      'job_title',
      'website',
      'status',
      'source',
      'source_detail',
      'industry',
      'city',
      'region',
      'country',
      'address',
      'value_estimate',
      'currency',
      'score',
      'priority',
      'owner_name',
      'next_action',
      'next_action_date',
      'notes',
      'product_interest',
      'converted_customer_id',
      'converted_opportunity_id',
      'converted_at',
      'last_contacted_at',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    const supabase = getSupabaseServer();
    const { data: before } = await supabase
      .from('leads')
      .select('status')
      .eq('id', Number(body.id))
      .maybeSingle();

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (body.status && before && before.status !== body.status) {
      await supabase.from('crm_activities').insert({
        profile_id: data.profile_id,
        entity_type: 'lead',
        entity_id: data.id,
        activity_type: 'stage_change',
        subject: `Status ${before.status} → ${body.status}`,
      });
    }

    return NextResponse.json({ success: true, lead: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
