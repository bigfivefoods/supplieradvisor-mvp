import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { assertCompanyPermission } from '@/lib/business/access';
import {
  ensureTradePortal,
  isTradePortalKind,
  listViewers,
  normalizeSections,
  portalPublicUrl,
  type TradePortalKind,
} from '@/lib/portals/trade-portal';

function resourceFor(kind: TradePortalKind) {
  return kind === 'customer' ? 'customers' : 'suppliers';
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const kindRaw = request.nextUrl.searchParams.get('kind');
    if (!Number.isFinite(companyId) || !isTradePortalKind(kindRaw)) {
      return NextResponse.json(
        { error: 'companyId and kind=customer|supplier required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const perm = await assertCompanyPermission(
      gate.userId,
      companyId,
      resourceFor(kindRaw),
      'view'
    );
    if (!perm.ok) {
      return NextResponse.json({ error: perm.error }, { status: perm.status });
    }

    const ensured = await ensureTradePortal({ companyId, kind: kindRaw });
    if (!ensured.ok) {
      return NextResponse.json(
        {
          error: ensured.error,
          hint: ensured.missingTable
            ? 'Run supabase/migrations/20260822_trade_portals.sql in the Supabase SQL editor.'
            : undefined,
        },
        { status: ensured.missingTable ? 503 : 500 }
      );
    }
    const viewers = await listViewers({
      companyId,
      portalId: ensured.portal.id,
    });
    return NextResponse.json({
      success: true,
      portal: ensured.portal,
      url: portalPublicUrl(ensured.portal.public_token),
      viewers: viewers.ok ? viewers.viewers : [],
      warning: viewers.ok ? undefined : viewers.error,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const kind = body.kind;
    if (!Number.isFinite(companyId) || !isTradePortalKind(kind)) {
      return NextResponse.json(
        { error: 'companyId and kind=customer|supplier required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const perm = await assertCompanyPermission(
      gate.userId,
      companyId,
      resourceFor(kind),
      'write'
    );
    if (!perm.ok) {
      return NextResponse.json({ error: perm.error }, { status: perm.status });
    }

    const ensured = await ensureTradePortal({ companyId, kind });
    if (!ensured.ok) {
      return NextResponse.json(
        { error: ensured.error },
        { status: ensured.missingTable ? 503 : 500 }
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.title === 'string') patch.title = body.title.slice(0, 120);
    if (typeof body.welcome_message === 'string') {
      patch.welcome_message = body.welcome_message.slice(0, 2000);
    }
    if (body.sections && typeof body.sections === 'object') {
      patch.sections = normalizeSections({
        ...ensured.portal.sections,
        ...body.sections,
      });
    }
    if (body.status === 'active' || body.status === 'paused') {
      patch.status = body.status;
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('trade_portals')
      .update(patch)
      .eq('id', ensured.portal.id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      portal: data,
      url: portalPublicUrl(String(data.public_token)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
