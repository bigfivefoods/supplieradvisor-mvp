import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import {
  computeFeasibility,
  normalizeFeasibilityInputs,
  type FeasibilityInputs,
} from '@/lib/containers/feasibility';

/**
 * GET ?companyId=&id= — list scenarios or one scenario + live compute
 * POST — save new scenario
 * PATCH — update scenario
 * DELETE ?companyId=&id=
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const id = sp.get('id') ? Number(sp.get('id')) : null;
    const supabase = getSupabaseServer();

    // Always return a live compute for defaults or draft body
    if (sp.get('preview') === '1') {
      const { inputs, results } = computeFeasibility({});
      return NextResponse.json({
        success: true,
        inputs,
        results,
        live: true,
      });
    }

    if (id && Number.isFinite(id)) {
      const { data, error } = await supabase
        .from('container_feasibility_scenarios')
        .select('*')
        .eq('profile_id', companyId)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        if (isMissingTable(error.message)) {
          return migrationRequired();
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }

      const { inputs, results } = computeFeasibility(
        (data.inputs || {}) as Partial<FeasibilityInputs>
      );
      return NextResponse.json({
        success: true,
        scenario: {
          ...data,
          inputs,
          results,
        },
      });
    }

    const { data, error } = await supabase
      .from('container_feasibility_scenarios')
      .select(
        'id, name, region_city, region_province, region_country, currency, feasibility_score, feasibility_band, results, updated_at, created_at'
      )
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      if (isMissingTable(error.message)) {
        const { inputs, results } = computeFeasibility({});
        return NextResponse.json({
          success: true,
          scenarios: [],
          inputs,
          results,
          migration_required: true,
          warning:
            'Run supabase/migrations/20260713_container_feasibility.sql to save scenarios. Calculator still works.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { inputs, results } = computeFeasibility({});
    return NextResponse.json({
      success: true,
      scenarios: data || [],
      inputs,
      results,
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
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const mem = await getCompanyMembership(gate.userId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!['owner', 'admin', 'operations', 'finance'].includes(mem.role)) {
      return NextResponse.json(
        { error: 'Only owners, admins, operations, or finance can save scenarios' },
        { status: 403 }
      );
    }

    const { inputs, results } = computeFeasibility(
      body.inputs || body || {}
    );
    const now = new Date().toISOString();
    const row = {
      profile_id: companyId,
      name: inputs.name,
      region_city: inputs.region_city || null,
      region_province: inputs.region_province || null,
      region_country: inputs.region_country || null,
      currency: inputs.currency,
      notes: inputs.notes || null,
      inputs,
      results,
      feasibility_score: results.feasibility_score,
      feasibility_band: results.feasibility_band,
      created_by: gate.userId,
      created_at: now,
      updated_at: now,
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_feasibility_scenarios')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      if (isMissingTable(error.message)) return migrationRequired();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scenario: data,
      inputs,
      results,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const { inputs, results } = computeFeasibility(body.inputs || body);
    const updates = {
      name: inputs.name,
      region_city: inputs.region_city || null,
      region_province: inputs.region_province || null,
      region_country: inputs.region_country || null,
      currency: inputs.currency,
      notes: inputs.notes || null,
      inputs,
      results,
      feasibility_score: results.feasibility_score,
      feasibility_band: results.feasibility_band,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_feasibility_scenarios')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingTable(error.message)) return migrationRequired();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      scenario: data,
      inputs,
      results,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('container_feasibility_scenarios')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);

    if (error) {
      if (isMissingTable(error.message)) return migrationRequired();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** Client-side style recompute without DB (POST body only) */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (Number.isFinite(companyId)) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
      });
      if (!gate.ok) return gate.response;
    }
    const { inputs, results } = computeFeasibility(
      body.inputs || normalizeFeasibilityInputs(body)
    );
    return NextResponse.json({ success: true, inputs, results });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function isMissingTable(msg?: string) {
  return Boolean(
    msg &&
      /does not exist|schema cache|could not find.*table|PGRST205/i.test(msg)
  );
}

function migrationRequired() {
  return NextResponse.json(
    {
      error: 'Feasibility scenarios table not set up yet',
      hint: 'Run supabase/migrations/20260713_container_feasibility.sql in Supabase SQL Editor',
      code: 'MIGRATION_REQUIRED',
    },
    { status: 503 }
  );
}
