import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  loadGroupCompaniesForProfile,
  syncGroupCompaniesToEntities,
} from '@/lib/accounting/entities-group';
import { linkTypeMeta } from '@/lib/business/company-groups';

const HINT =
  'Run supabase/migrations/20260710_accounting_module.sql and 20260723_accounting_entities_group.sql';

export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(
      request.nextUrl.searchParams.get('companyId')
    );

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const autoSync =
      request.nextUrl.searchParams.get('syncGroup') === '1' ||
      request.nextUrl.searchParams.get('syncGroup') === 'true';

    if (autoSync) {
      await syncGroupCompaniesToEntities(companyId);
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('accounting_entities')
      .select('*')
      .eq('profile_id', companyId)
      .order('is_primary', { ascending: false })
      .order('name');

    if (error) {
      return NextResponse.json({
        success: true,
        entities: [],
        groupCompanies: [],
        warning: error.message,
        hint: HINT,
      });
    }

    const { companies: groupCompanies, warning: groupWarning } =
      await loadGroupCompaniesForProfile(companyId);

    const groupByProfile = new Map(
      groupCompanies.map((g) => [g.profile_id, g] as const)
    );

    const entities = (data || []).map((e) => {
      const linked =
        e.linked_profile_id != null
          ? Number(e.linked_profile_id)
          : e.metadata &&
              typeof e.metadata === 'object' &&
              (e.metadata as { linked_profile_id?: number }).linked_profile_id
            ? Number(
                (e.metadata as { linked_profile_id?: number }).linked_profile_id
              )
            : null;
      const g = linked != null ? groupByProfile.get(linked) : undefined;
      const metaType =
        e.metadata && typeof e.metadata === 'object'
          ? String(
              (e.metadata as { link_type?: string }).link_type || ''
            )
          : '';
      return {
        ...e,
        linked_profile_id: linked,
        group_link_type: g?.link_type || metaType || null,
        group_link_label: g
          ? g.link_type_label
          : metaType
            ? linkTypeMeta(metaType).label
            : null,
        group_role: g?.role || null,
      };
    });

    const unsyncedGroup = groupCompanies.filter((g) => !g.entity_id);

    return NextResponse.json({
      success: true,
      entities,
      groupCompanies,
      unsyncedCount: unsyncedGroup.length,
      summary: {
        entityCount: entities.length,
        groupCount: groupCompanies.filter((g) => g.link_type !== 'self').length,
        unsyncedCount: unsyncedGroup.length,
      },
      warning: groupWarning,
      hint: groupWarning ? 'Run supabase/migrations/20260723_company_group_links.sql' : undefined,
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
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: privyUserId || legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'create').toLowerCase();

    // ── Sync all active group companies into legal entities ───────────────
    if (action === 'sync_group' || action === 'sync') {
      const result = await syncGroupCompaniesToEntities(companyId);
      return NextResponse.json({
        success: true,
        created: result.created,
        updated: result.updated,
        groupCompanies: result.companies,
        message:
          result.created > 0
            ? `Added ${result.created} group compan${result.created === 1 ? 'y' : 'ies'} as legal entities`
            : result.updated > 0
              ? `Refreshed ${result.updated} linked entit${result.updated === 1 ? 'y' : 'ies'}`
              : 'No group companies to sync — link companies under Company → Group first',
      });
    }

    if (!body.code || !body.name) {
      return NextResponse.json(
        { error: 'companyId, code, and name required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    if (body.is_primary) {
      await supabase
        .from('accounting_entities')
        .update({ is_primary: false })
        .eq('profile_id', companyId);
    }

    const linkedProfileId =
      body.linked_profile_id != null && Number(body.linked_profile_id) > 0
        ? Number(body.linked_profile_id)
        : body.linkedProfileId != null && Number(body.linkedProfileId) > 0
          ? Number(body.linkedProfileId)
          : null;

    const insertRow: Record<string, unknown> = {
      profile_id: companyId,
      code: String(body.code).trim(),
      name: String(body.name).trim(),
      legal_name: body.legal_name || null,
      country: body.country || 'ZA',
      currency: body.currency || 'ZAR',
      tax_number: body.tax_number || null,
      registration_number: body.registration_number || null,
      is_primary: !!body.is_primary,
      status: body.status || 'active',
      address: body.address || null,
      metadata: {
        ...(body.metadata && typeof body.metadata === 'object'
          ? body.metadata
          : {}),
        ...(linkedProfileId
          ? { linked_profile_id: linkedProfileId, source: 'manual_link' }
          : {}),
      },
    };
    if (linkedProfileId) insertRow.linked_profile_id = linkedProfileId;

    const { data, error } = await supabase
      .from('accounting_entities')
      .insert(insertRow)
      .select('*')
      .single();

    if (error) {
      // Retry without linked_profile_id if column missing
      if (/linked_profile_id|column|schema cache/i.test(error.message)) {
        delete insertRow.linked_profile_id;
        const retry = await supabase
          .from('accounting_entities')
          .insert(insertRow)
          .select('*')
          .single();
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, entity: retry.data });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, entity: data });
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
    const companyId = parseCompanyId(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: privyUserId || legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    if (body.is_primary) {
      await supabase
        .from('accounting_entities')
        .update({ is_primary: false })
        .eq('profile_id', companyId);
    }

    const allowed = [
      'code',
      'name',
      'legal_name',
      'country',
      'currency',
      'tax_number',
      'registration_number',
      'is_primary',
      'status',
      'address',
      'linked_profile_id',
    ];
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const { data, error } = await supabase
      .from('accounting_entities')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, entity: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
