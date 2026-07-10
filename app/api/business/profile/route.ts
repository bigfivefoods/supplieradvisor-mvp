import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  PROFILE_EDITABLE_FIELDS,
  normalizeProfileRow,
} from '@/lib/business/types';
import { computeDetailedCompleteness } from '@/lib/business/completeness';

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
    const completeness = computeDetailedCompleteness(profile as Record<string, unknown>);

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
        f === 'industries' ||
        f === 'sub_industries'
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

      if (
        f === 'uploaded_certificates' ||
        f === 'export_licenses' ||
        f === 'metadata'
      ) {
        updates[f] = body[f];
        continue;
      }

      if (f === 'latitude' || f === 'longitude' || f === 'lat' || f === 'lng') {
        const n = body[f] === '' || body[f] == null ? null : Number(body[f]);
        updates[f] = n != null && Number.isFinite(n) ? n : null;
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
    // Dual-write business_type ↔ category (legacy alias)
    if (updates.business_type != null && updates.category === undefined) {
      updates.category = updates.business_type;
    }
    if (updates.category != null && updates.business_type === undefined) {
      updates.business_type = updates.category;
    }
    // Normalize structured certs + keep name arrays aligned (preserve file_url always)
    if (Array.isArray(updates.uploaded_certificates)) {
      const normalized = (updates.uploaded_certificates as Array<Record<string, unknown>>)
        .filter((c) => c && typeof c === 'object')
        .map((c) => {
          const fileUrl = c.file_url ? String(c.file_url) : null;
          const name = String(c.name || '').trim() || (fileUrl ? 'Certificate' : '');
          return {
            name,
            awarded_date: c.awarded_date ? String(c.awarded_date) : null,
            expiry_date: c.expiry_date ? String(c.expiry_date) : null,
            file_url: fileUrl,
          };
        })
        .filter((c) => c.name || c.file_url);
      updates.uploaded_certificates = normalized;
      const names = normalized.map((c) => c.name).filter(Boolean);
      if (updates.certifications === undefined) updates.certifications = names;
      if (updates.iso_certifications === undefined) updates.iso_certifications = names;
    }
    // Normalize export licenses JSON (preserve file_url)
    if (Array.isArray(updates.export_licenses)) {
      updates.export_licenses = (updates.export_licenses as Array<Record<string, unknown>>)
        .filter((e) => e && typeof e === 'object')
        .map((e) => ({
          country: String(e.country || '').trim(),
          license_number: e.license_number ? String(e.license_number) : null,
          file_url: e.file_url ? String(e.file_url) : null,
        }))
        .filter((e) => e.country);
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
    if (
      Array.isArray(updates.sub_industries) &&
      (updates.sub_industries as string[]).length > 0 &&
      updates.sub_industry === undefined
    ) {
      updates.sub_industry = String((updates.sub_industries as string[])[0]);
    }
    // Dual-write lat/lng aliases
    if (updates.latitude != null && updates.lat === undefined) {
      updates.lat = updates.latitude;
    }
    if (updates.longitude != null && updates.lng === undefined) {
      updates.lng = updates.longitude;
    }
    if (updates.lat != null && updates.latitude === undefined) {
      updates.latitude = updates.lat;
    }
    if (updates.lng != null && updates.longitude === undefined) {
      updates.longitude = updates.lng;
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
      completeness: computeDetailedCompleteness(profile as Record<string, unknown>),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
