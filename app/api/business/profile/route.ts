import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import { PROFILE_EDITABLE_FIELDS } from '@/lib/business/types';

const PROFILE_SELECT = `
  id, trading_name, legal_name, email, contact_name, contact_phone, phone, website,
  industry, sub_industry, category, business_type, description, about,
  city, region, province, country, continent, address, postal_code,
  bee_level, registration_number, vat_number, tax_number, certifications,
  wallet_address, logo_url, primary_currency, timezone, is_buyer, is_discoverable,
  verification_status, is_verified, relationship_type, supplier_status, public_id,
  settings, metadata, created_at, updated_at
`;

/**
 * GET ?companyId=&privyUserId=
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', companyId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const completeness = computeCompleteness(data as Record<string, unknown>);
    return NextResponse.json({ success: true, profile: data, completeness });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH — update company profile (membership required)
 * Body: { companyId, privyUserId, ...fields }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const f of PROFILE_EDITABLE_FIELDS) {
      if (body[f] !== undefined) {
        if (f === 'email' && body[f]) {
          updates[f] = String(body[f]).toLowerCase().trim();
        } else if (f === 'certifications') {
          updates[f] = Array.isArray(body[f])
            ? body[f].map(String)
            : typeof body[f] === 'string'
              ? String(body[f])
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
        } else if (f === 'is_buyer' || f === 'is_discoverable') {
          updates[f] = Boolean(body[f]);
        } else {
          updates[f] = body[f] === '' ? null : body[f];
        }
      }
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    let { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', companyId)
      .select(PROFILE_SELECT)
      .single();

    if (error && /column|schema cache/i.test(error.message || '')) {
      // Retry without optional columns
      const safe: Record<string, unknown> = { updated_at: updates.updated_at };
      for (const k of [
        'trading_name',
        'legal_name',
        'email',
        'contact_name',
        'contact_phone',
        'website',
        'industry',
        'city',
        'country',
        'address',
      ]) {
        if (updates[k] !== undefined) safe[k] = updates[k];
      }
      const retry = await supabase
        .from('profiles')
        .update(safe)
        .eq('id', companyId)
        .select(PROFILE_SELECT)
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_business_workspace.sql' },
        { status: 500 }
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'business.profile_updated',
      entity_type: 'profiles',
      entity_id: String(companyId),
      summary: 'Company profile updated',
      metadata: { fields: Object.keys(updates).filter((k) => k !== 'updated_at') },
    });

    return NextResponse.json({
      success: true,
      profile: data,
      completeness: computeCompleteness((data || {}) as Record<string, unknown>),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

function computeCompleteness(p: Record<string, unknown>) {
  const checks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: 'trading_name', label: 'Trading name', ok: !!p.trading_name },
    { key: 'legal_name', label: 'Legal name', ok: !!p.legal_name },
    { key: 'email', label: 'Email', ok: !!p.email },
    { key: 'contact_name', label: 'Contact name', ok: !!p.contact_name },
    { key: 'phone', label: 'Phone', ok: !!(p.phone || p.contact_phone) },
    { key: 'website', label: 'Website', ok: !!p.website },
    { key: 'industry', label: 'Industry', ok: !!p.industry },
    { key: 'country', label: 'Country', ok: !!p.country },
    { key: 'city', label: 'City', ok: !!p.city },
    { key: 'address', label: 'Address', ok: !!p.address },
    {
      key: 'registration',
      label: 'Registration / VAT',
      ok: !!(p.registration_number || p.vat_number),
    },
    {
      key: 'certs',
      label: 'Certifications',
      ok: Array.isArray(p.certifications) && (p.certifications as unknown[]).length > 0,
    },
  ];
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);
  return { pct, done, total: checks.length, checks };
}
