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
  newPortalToken,
  portalPublicUrl,
  type TradePortalKind,
} from '@/lib/portals/trade-portal';
import { sendTradePortalAccessEmail } from '@/lib/portals/trade-portal-email';

function resourceFor(kind: TradePortalKind) {
  return kind === 'customer' ? 'customers' : 'suppliers';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const kind = body.kind;
    const name = String(body.name || '').trim();
    if (!Number.isFinite(companyId) || !isTradePortalKind(kind) || !name) {
      return NextResponse.json(
        { error: 'companyId, kind, and name required' },
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

    const customerId = Number(body.customer_id);
    const supplierId = Number(body.supplier_id);
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    const row = {
      portal_id: ensured.portal.id,
      profile_id: companyId,
      name: name.slice(0, 120),
      email: email.includes('@') ? email : null,
      phone: String(body.phone || '').trim().slice(0, 40) || null,
      job_title: String(body.job_title || '').trim().slice(0, 80) || null,
      token: newPortalToken('viewer'),
      customer_id:
        kind === 'customer' && Number.isFinite(customerId) && customerId > 0
          ? customerId
          : null,
      supplier_id:
        kind === 'supplier' && Number.isFinite(supplierId) && supplierId > 0
          ? supplierId
          : null,
      status: 'active',
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('trade_portal_viewers')
      .insert(row)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const url = portalPublicUrl(String(data.token));
    let emailSent = false;
    let emailWarning: string | undefined;
    if (row.email && body.sendEmail !== false) {
      const { data: host } = await supabase
        .from('profiles')
        .select('trading_name, legal_name, logo_url')
        .eq('id', companyId)
        .maybeSingle();
      const mailed = await sendTradePortalAccessEmail({
        to: row.email,
        guestName: row.name,
        hostName:
          String(host?.trading_name || host?.legal_name || '').trim() ||
          'SupplierAdvisor company',
        kind,
        portalUrl: url,
        logoUrl: host?.logo_url ? String(host.logo_url) : null,
      });
      emailSent = mailed.sent;
      emailWarning = mailed.warning;
    }

    return NextResponse.json({
      success: true,
      viewer: data,
      url,
      emailSent,
      warning: emailWarning,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const kind = body.kind;
    if (
      !Number.isFinite(companyId) ||
      !Number.isFinite(id) ||
      !isTradePortalKind(kind)
    ) {
      return NextResponse.json(
        { error: 'companyId, kind, and id required' },
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

    const supabase = getSupabaseServer();
    const action = String(body.action || '');

    if (action === 'revoke') {
      const { error } = await supabase
        .from('trade_portal_viewers')
        .update({
          status: 'revoked',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', companyId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, revoked: true });
    }

    if (action === 'restore') {
      const { error } = await supabase
        .from('trade_portal_viewers')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', companyId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, restored: true });
    }

    if (action === 'resend') {
      const { data: viewer, error } = await supabase
        .from('trade_portal_viewers')
        .select('*')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !viewer) {
        return NextResponse.json(
          { error: error?.message || 'Person not found' },
          { status: 404 }
        );
      }
      if (!viewer.email) {
        return NextResponse.json(
          { error: 'This person has no email' },
          { status: 400 }
        );
      }
      const { data: host } = await supabase
        .from('profiles')
        .select('trading_name, legal_name, logo_url')
        .eq('id', companyId)
        .maybeSingle();
      const url = portalPublicUrl(String(viewer.token));
      const mailed = await sendTradePortalAccessEmail({
        to: String(viewer.email),
        guestName: String(viewer.name || 'there'),
        hostName:
          String(host?.trading_name || host?.legal_name || '').trim() ||
          'SupplierAdvisor company',
        kind,
        portalUrl: url,
        logoUrl: host?.logo_url ? String(host.logo_url) : null,
      });
      return NextResponse.json({
        success: true,
        url,
        emailSent: mailed.sent,
        warning: mailed.warning,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
