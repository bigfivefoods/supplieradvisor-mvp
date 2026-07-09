import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { stageProbability } from '@/lib/customers/types';

function normalizeStage(stage?: string | null, status?: string | null) {
  // Map legacy kanban labels to stages
  const s = (stage || status || 'prospecting').toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    prospect: 'prospecting',
    prospecting: 'prospecting',
    qualified: 'qualification',
    qualification: 'qualification',
    needs_analysis: 'needs_analysis',
    proposal: 'proposal',
    negotiation: 'negotiation',
    closing: 'negotiation',
    won: 'closed_won',
    closed_won: 'closed_won',
    lost: 'closed_lost',
    closed_lost: 'closed_lost',
  };
  return map[s] || s || 'prospecting';
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const stage = request.nextUrl.searchParams.get('stage');
    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    let query = supabase
      .from('opportunities')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(500);
    if (stage && stage !== 'all') {
      query = query.or(`stage.eq.${stage},status.eq.${stage}`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        opportunities: [],
        warning: error.message,
        hint: 'Run 20260709_crm_leads_opportunities.sql',
      });
    }

    let opportunities = (data || []).map((o) => {
      const st = normalizeStage(o.stage, o.status);
      const amount = Number(o.amount ?? o.opportunity_size ?? 0);
      const probability =
        o.probability != null ? Number(o.probability) : stageProbability(st);
      return {
        ...o,
        stage: st,
        amount,
        probability,
        expected_close_date: o.expected_close_date || o.estimated_date || null,
        contact_phone: o.contact_phone || o.contact_number || null,
        location: o.location || o.opportunity_location || null,
        description: o.description || o.notes || null,
        weighted_amount: Math.round((amount * probability) / 100),
      };
    });

    if (q) {
      opportunities = opportunities.filter((o) => {
        const hay = [
          o.name,
          o.contact_name,
          o.company_name,
          o.contact_email,
          o.contact_phone,
          o.stage,
          o.product_interest,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return NextResponse.json({ success: true, opportunities });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const name =
      body.name ||
      body.contact_name ||
      (body.company_name ? `${body.company_name} opportunity` : null);
    if (!name) {
      return NextResponse.json({ error: 'name or contact_name required' }, { status: 400 });
    }

    const stage = normalizeStage(body.stage, body.status);
    const amount = Number(body.amount ?? body.opportunity_size ?? 0);
    const probability =
      body.probability != null ? Number(body.probability) : stageProbability(stage);
    const status =
      stage === 'closed_won' ? 'won' : stage === 'closed_lost' ? 'lost' : body.status || 'open';

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      profile_id: companyId,
      lead_id: body.lead_id || null,
      customer_id: body.customer_id || null,
      name: String(name).trim(),
      contact_name: body.contact_name || null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || body.contact_number || null,
      contact_number: body.contact_phone || body.contact_number || null,
      company_name: body.company_name || null,
      stage,
      status,
      probability,
      amount,
      opportunity_size: amount,
      currency: body.currency || 'ZAR',
      expected_close_date: body.expected_close_date || body.estimated_date || null,
      estimated_date: body.expected_close_date || body.estimated_date || null,
      actual_close_date: body.actual_close_date || null,
      opportunity_type: body.opportunity_type || 'new_business',
      product_interest: body.product_interest || null,
      location: body.location || body.opportunity_location || null,
      opportunity_location: body.location || body.opportunity_location || null,
      description: body.description || body.notes || null,
      notes: body.notes || body.description || null,
      next_step: body.next_step || null,
      next_step_date: body.next_step_date || null,
      owner_name: body.owner_name || null,
      competitor: body.competitor || null,
      lost_reason: body.lost_reason || null,
      source: body.source || null,
      priority: body.priority || 'medium',
      updated_at: now,
    };

    let { data, error } = await supabase.from('opportunities').insert(payload).select('*').single();
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const minimal = {
        profile_id: companyId,
        name: payload.name,
        contact_name: payload.contact_name,
        contact_number: payload.contact_phone,
        opportunity_size: amount,
        status: stage,
        estimated_date: payload.expected_close_date,
        opportunity_location: payload.location,
        description: payload.description,
      };
      const retry = await supabase.from('opportunities').insert(minimal).select('*').single();
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
      entity_type: 'opportunity',
      entity_id: data.id,
      activity_type: 'note',
      subject: 'Opportunity created',
      body: body.description || body.notes || null,
    });

    return NextResponse.json({ success: true, opportunity: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const fields = [
      'name',
      'lead_id',
      'customer_id',
      'contact_name',
      'contact_email',
      'contact_phone',
      'company_name',
      'stage',
      'status',
      'probability',
      'amount',
      'currency',
      'expected_close_date',
      'actual_close_date',
      'opportunity_type',
      'product_interest',
      'location',
      'description',
      'notes',
      'next_step',
      'next_step_date',
      'owner_name',
      'competitor',
      'lost_reason',
      'source',
      'priority',
    ] as const;

    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    // Keep legacy columns in sync
    if (body.stage !== undefined) {
      const stage = normalizeStage(body.stage, body.status);
      updates.stage = stage;
      updates.status =
        stage === 'closed_won' ? 'won' : stage === 'closed_lost' ? 'lost' : body.status || 'open';
      if (body.probability === undefined) updates.probability = stageProbability(stage);
      if (stage === 'closed_won' || stage === 'closed_lost') {
        updates.actual_close_date = body.actual_close_date || new Date().toISOString().slice(0, 10);
      }
    }
    if (body.amount !== undefined) {
      updates.amount = Number(body.amount);
      updates.opportunity_size = Number(body.amount);
    }
    if (body.opportunity_size !== undefined && body.amount === undefined) {
      updates.amount = Number(body.opportunity_size);
      updates.opportunity_size = Number(body.opportunity_size);
    }
    if (body.contact_phone !== undefined) updates.contact_number = body.contact_phone;
    if (body.expected_close_date !== undefined) updates.estimated_date = body.expected_close_date;
    if (body.location !== undefined) updates.opportunity_location = body.location;
    if (body.description !== undefined && body.notes === undefined) updates.notes = body.description;

    const supabase = getSupabaseServer();
    const { data: before } = await supabase
      .from('opportunities')
      .select('stage, status')
      .eq('id', Number(body.id))
      .maybeSingle();

    let { data, error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const soft: Record<string, unknown> = {
        contact_name: updates.contact_name,
        contact_number: updates.contact_phone || updates.contact_number,
        opportunity_size: updates.amount || updates.opportunity_size,
        status: updates.stage || updates.status,
        estimated_date: updates.expected_close_date || updates.estimated_date,
        opportunity_location: updates.location,
        description: updates.description || updates.notes,
      };
      const retry = await supabase
        .from('opportunities')
        .update(soft)
        .eq('id', Number(body.id))
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const prevStage = normalizeStage(before?.stage, before?.status);
    const nextStage = normalizeStage(data.stage, data.status);
    if (prevStage !== nextStage) {
      await supabase.from('crm_activities').insert({
        profile_id: data.profile_id,
        entity_type: 'opportunity',
        entity_id: data.id,
        activity_type: 'stage_change',
        subject: `Stage ${prevStage} → ${nextStage}`,
      });
    }

    return NextResponse.json({ success: true, opportunity: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
