import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { ensureTradePortal, portalPublicUrl } from '@/lib/portals/trade-portal';
import { issueAccountPortal } from '@/lib/portals/trade-portal-people';
import { sendTradePortalAccessEmail } from '@/lib/portals/trade-portal-email';

function sanitize(v: unknown, n = 120) {
  return String(v || '').trim().slice(0, n);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    let customerId = Number(body.customerId || 0);
    if (!(customerId > 0)) {
      const prospect = (body.prospect || {}) as Record<string, unknown>;
      const tradingName = sanitize(prospect.tradingName, 160);
      const contactName = sanitize(prospect.contactName, 120);
      const email = sanitize(prospect.email, 160).toLowerCase();
      const phone = sanitize(prospect.phone, 40);

      if (!tradingName || !contactName || !email) {
        return NextResponse.json({ error: 'prospect.tradingName, contactName, and email are required' }, { status: 400 });
      }

      const { data: inserted, error } = await supabase
        .from('customers')
        .insert({
          profile_id: companyId,
          trading_name: tradingName,
          legal_name: tradingName,
          contact_name: contactName,
          email,
          phone: phone || null,
          status: 'prospect',
          customer_type: 'business',
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error || !inserted) {
        return NextResponse.json({ error: error?.message || 'Could not create prospect' }, { status: 500 });
      }
      customerId = Number(inserted.id);
    }

    const ensured = await ensureTradePortal({ companyId, kind: 'customer' });
    if (!ensured.ok) {
      return NextResponse.json({ error: ensured.error }, { status: ensured.missingTable ? 503 : 500 });
    }

    const issued = await issueAccountPortal({
      companyId,
      kind: 'customer',
      customerId,
      sendEmail: false,
    });
    if (!issued.ok) {
      return NextResponse.json({ error: issued.error }, { status: issued.status });
    }

    const link = `${portalPublicUrl(issued.viewer.token)}?tab=credit`;

    const { data: host } = await supabase
      .from('profiles')
      .select('trading_name, legal_name, logo_url')
      .eq('id', companyId)
      .maybeSingle();

    const { data: customer } = await supabase
      .from('customers')
      .select('trading_name, contact_name, email')
      .eq('id', customerId)
      .eq('profile_id', companyId)
      .maybeSingle();

    let emailSent = false;
    let warning: string | undefined;
    const to = sanitize(issued.viewer.email || customer?.email || '', 180).toLowerCase();
    if (to && to.includes('@')) {
      const mailed = await sendTradePortalAccessEmail({
        to,
        guestName: sanitize(issued.viewer.name || customer?.contact_name || customer?.trading_name || 'there', 120),
        hostName:
          sanitize(host?.trading_name || host?.legal_name || '', 120) ||
          'SupplierAdvisor company',
        kind: 'customer',
        portalUrl: link,
        logoUrl: host?.logo_url ? String(host.logo_url) : null,
      });
      emailSent = mailed.sent;
      warning = mailed.warning;
    }

    return NextResponse.json({
      success: true,
      customerId,
      viewerId: issued.viewer.id,
      token: issued.viewer.token,
      link,
      emailSent,
      warning,
      existing: issued.existing === true,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
