import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { assertCompanyPermission } from '@/lib/business/access';
import {
  isTradePortalKind,
  portalPublicUrl,
  type TradePortalKind,
} from '@/lib/portals/trade-portal';
import { sendTradePortalAccessEmail } from '@/lib/portals/trade-portal-email';
import {
  inviteTradePortalPerson,
  issueAccountPortal,
} from '@/lib/portals/trade-portal-people';

function resourceFor(kind: TradePortalKind) {
  return kind === 'customer' ? 'customers' : 'suppliers';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const kind = body.kind;
    const action = String(body.action || 'add');
    const name = String(body.name || '').trim();
    if (!Number.isFinite(companyId) || !isTradePortalKind(kind)) {
      return NextResponse.json(
        { error: 'companyId and kind required' },
        { status: 400 }
      );
    }
    if (action !== 'issue_account' && !name) {
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

    const customerId = Number(body.customer_id);
    const supplierId = Number(body.supplier_id);
    if (action === 'issue_account') {
      const issued = await issueAccountPortal({
        companyId,
        kind,
        customerId: kind === 'customer' ? customerId : null,
        supplierId: kind === 'supplier' ? supplierId : null,
      });
      if (!issued.ok) {
        return NextResponse.json(
          { error: issued.error },
          { status: issued.status }
        );
      }
      return NextResponse.json({
        success: true,
        viewer: issued.viewer,
        url: issued.url,
        emailSent: issued.emailSent,
        warning: issued.warning,
        existing: issued.existing === true,
      });
    }

    const invited = await inviteTradePortalPerson({
      companyId,
      kind,
      name,
      email: body.email,
      phone: body.phone,
      job_title: body.job_title,
      customerId: kind === 'customer' ? customerId : null,
      supplierId: kind === 'supplier' ? supplierId : null,
      sendEmail: body.sendEmail !== false,
    });
    if (!invited.ok) {
      return NextResponse.json(
        { error: invited.error },
        { status: invited.status }
      );
    }
    return NextResponse.json({
      success: true,
      viewer: invited.viewer,
      url: invited.url,
      emailSent: invited.emailSent,
      warning: invited.warning,
      existing: invited.existing === true,
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
