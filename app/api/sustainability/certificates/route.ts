import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { MIGRATION_HINT, daysUntil } from '@/lib/sustainability/types';

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

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sustainability_certificates')
      .select('*')
      .eq('profile_id', companyId)
      .order('expires_at', { ascending: true, nullsFirst: false });

    if (error) {
      return NextResponse.json({
        success: true,
        certificates: [],
        warning: error.message,
        hint: MIGRATION_HINT,
      });
    }

    const certificates = (data || []).map((c) => {
      const days = daysUntil(c.expires_at);
      let expiry_status = 'ok';
      if (days != null) {
        if (days < 0) expiry_status = 'expired';
        else if (days <= 90) expiry_status = 'expiring_soon';
      }
      return { ...c, days_until_expiry: days, expiry_status };
    });

    return NextResponse.json({
      success: true,
      certificates,
      summary: {
        total: certificates.length,
        active: certificates.filter((c) => c.status === 'active').length,
        expiring_soon: certificates.filter((c) => c.expiry_status === 'expiring_soon')
          .length,
        expired: certificates.filter((c) => c.expiry_status === 'expired').length,
      },
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!String(body.name || '').trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const row: Record<string, unknown> = {
      profile_id: companyId,
      name: String(body.name).trim(),
      standard: body.standard || null,
      issuer: body.issuer || null,
      issued_at: body.issued_at || null,
      expires_at: body.expires_at || null,
      file_url: body.file_url || null,
      status: body.status || 'active',
      certificate_type: body.certificate_type || 'other',
      scope_notes: body.scope_notes || null,
      verified: Boolean(body.verified),
      created_by: mem.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('sustainability_certificates')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      // Soft retry without extended columns
      if (/column|schema cache|does not exist/i.test(error.message)) {
        const { data: soft, error: softErr } = await supabase
          .from('sustainability_certificates')
          .insert({
            profile_id: companyId,
            name: String(body.name).trim(),
            standard: body.standard || null,
            issuer: body.issuer || null,
            issued_at: body.issued_at || null,
            expires_at: body.expires_at || null,
            file_url: body.file_url || null,
            status: body.status || 'active',
          })
          .select('*')
          .single();
        if (softErr) {
          return NextResponse.json(
            { error: softErr.message, hint: MIGRATION_HINT },
            { status: 503 }
          );
        }
        return NextResponse.json(
          { success: true, certificate: soft, warning: error.message },
          { status: 201 }
        );
      }
      return NextResponse.json(
        { error: error.message, hint: MIGRATION_HINT },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, certificate: data }, { status: 201 });
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'name',
      'standard',
      'issuer',
      'issued_at',
      'expires_at',
      'file_url',
      'status',
      'certificate_type',
      'scope_notes',
      'verified',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('sustainability_certificates')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, certificate: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
