import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  PROFILE_EDITABLE_FIELDS,
  normalizeProfileRow,
} from '@/lib/business/types';

/**
 * GET ?companyId=&privyUserId=
 *
 * Always selects * from profiles so legacy columns (street, contact_number,
 * short_description, iso_certifications, bank_*, etc.) are never dropped.
 * Membership is checked when privyUserId is provided, but GET soft-fails
 * membership so the selected company row still returns (with a warning).
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    let membershipWarning: string | undefined;
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) {
        // Soft-fail: still load the profile for the selected company so data
        // is not "lost" in the UI if membership id formats drift.
        membershipWarning = mem.error;
        console.warn('business/profile GET membership soft-fail:', mem.error, {
          companyId,
        });
      }
    }

    const supabase = getSupabaseServer();
    // select('*') — never omit existing production columns
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    if (error) {
      console.error('business/profile GET:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const profile = normalizeProfileRow(data as Record<string, unknown>);
    const completeness = computeCompleteness(profile as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      profile,
      rawKeys: Object.keys(data),
      completeness,
      warning: membershipWarning,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH — update company profile (membership required for writes)
 * Accepts legacy + modern field names; dual-writes aliases so both UIs stay in sync.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const f of PROFILE_EDITABLE_FIELDS) {
      if (body[f] === undefined) continue;

      if (f === 'email' && body[f]) {
        updates[f] = String(body[f]).toLowerCase().trim();
        continue;
      }

      if (
        f === 'certifications' ||
        f === 'iso_certifications' ||
        f === 'industries'
      ) {
        const arr = Array.isArray(body[f])
          ? body[f].map(String)
          : typeof body[f] === 'string'
            ? String(body[f])
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
        updates[f] = arr;
        continue;
      }

      if (f === 'is_buyer' || f === 'is_discoverable') {
        updates[f] = Boolean(body[f]);
        continue;
      }

      if (f === 'uploaded_certificates' || f === 'metadata') {
        updates[f] = body[f];
        continue;
      }

      updates[f] = body[f] === '' ? null : body[f];
    }

    // Dual-write aliases so legacy + new columns stay consistent
    if (updates.contact_phone != null && updates.contact_number === undefined) {
      updates.contact_number = updates.contact_phone;
    }
    if (updates.contact_number != null && updates.contact_phone === undefined) {
      updates.contact_phone = updates.contact_number;
    }
    if (updates.contact_phone != null && updates.phone === undefined) {
      updates.phone = updates.contact_phone;
    }
    if (updates.address != null && updates.street === undefined) {
      updates.street = updates.address;
    }
    if (updates.street != null && updates.address === undefined) {
      updates.address = updates.street;
    }
    if (updates.description != null && updates.short_description === undefined) {
      updates.short_description = updates.description;
    }
    if (updates.short_description != null && updates.description === undefined) {
      updates.description = updates.short_description;
    }
    if (updates.certifications != null && updates.iso_certifications === undefined) {
      updates.iso_certifications = updates.certifications;
    }
    if (updates.iso_certifications != null && updates.certifications === undefined) {
      updates.certifications = updates.iso_certifications;
    }
    if (updates.industry != null && updates.industries === undefined) {
      updates.industries = [String(updates.industry)];
    }
    if (
      Array.isArray(updates.industries) &&
      updates.industries.length > 0 &&
      updates.industry === undefined
    ) {
      updates.industry = String((updates.industries as string[])[0]);
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // First attempt: full update
    let { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', companyId)
      .select('*')
      .single();

    // If unknown columns, strip them and retry remaining
    if (error && /column|schema cache|does not exist/i.test(error.message || '')) {
      console.warn('business/profile PATCH retry stripping unknown cols:', error.message);
      // Load existing row, only update keys that exist
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      const existingKeys = new Set(Object.keys(existing));
      const safe: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (existingKeys.has(k) || k === 'updated_at') safe[k] = v;
      }
      const retry = await supabase
        .from('profiles')
        .update(safe)
        .eq('id', companyId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('business/profile PATCH:', error);
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Ensure profiles columns exist; run 20260709_business_workspace.sql for optional settings fields only.',
        },
        { status: 500 }
      );
    }

    const profile = normalizeProfileRow((data || {}) as Record<string, unknown>);

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'business.profile_updated',
      entity_type: 'profiles',
      entity_id: String(companyId),
      summary: 'Company profile updated',
      metadata: {
        fields: Object.keys(updates).filter((k) => k !== 'updated_at'),
      },
    });

    return NextResponse.json({
      success: true,
      profile,
      completeness: computeCompleteness(profile as Record<string, unknown>),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

function computeCompleteness(p: Record<string, unknown>) {
  const phone = p.phone || p.contact_phone || p.contact_number;
  const address = p.address || p.street;
  const description = p.description || p.short_description || p.about;
  const certs = (p.certifications as unknown[]) || (p.iso_certifications as unknown[]) || [];
  const industry = p.industry || (Array.isArray(p.industries) ? p.industries[0] : p.industries);

  const checks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: 'trading_name', label: 'Trading name', ok: !!p.trading_name },
    { key: 'legal_name', label: 'Legal name', ok: !!p.legal_name },
    { key: 'email', label: 'Email', ok: !!p.email },
    { key: 'contact_name', label: 'Contact name', ok: !!p.contact_name },
    { key: 'phone', label: 'Phone', ok: !!phone },
    { key: 'website', label: 'Website', ok: !!p.website },
    { key: 'industry', label: 'Industry', ok: !!industry },
    { key: 'country', label: 'Country', ok: !!p.country },
    { key: 'city', label: 'City', ok: !!p.city },
    { key: 'address', label: 'Address', ok: !!address },
    {
      key: 'registration',
      label: 'Registration / VAT',
      ok: !!(p.registration_number || p.vat_number),
    },
    { key: 'description', label: 'Description', ok: !!description },
    { key: 'certs', label: 'Certifications', ok: Array.isArray(certs) && certs.length > 0 },
    { key: 'wallet', label: 'Wallet', ok: !!p.wallet_address },
  ];
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);
  return { pct, done, total: checks.length, checks };
}
