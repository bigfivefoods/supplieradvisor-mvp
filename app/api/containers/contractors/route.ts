import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

const CONTRACTOR_FIELDS = [
  'full_name',
  'email',
  'phone',
  'id_number',
  'status',
  'training_status',
  'bank_details',
  'id_document_url',
  'id_document_name',
  'id_document_uploaded_at',
  'verification_status',
  'consent_identity_check',
  'consent_identity_at',
] as const;

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_contractors')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, contractors: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId ?? body.profile_id);
    if (!Number.isFinite(companyId) || !body.full_name) {
      return NextResponse.json({ error: 'companyId and full_name are required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const payload: Record<string, unknown> = {
      profile_id: companyId,
      full_name: String(body.full_name).trim(),
      email: body.email || null,
      phone: body.phone || null,
      id_number: body.id_number ? String(body.id_number).replace(/\s/g, '') : null,
      status: body.status || 'active',
      training_status: body.training_status || 'pending',
      bank_details: body.bank_details || {},
      id_document_url: body.id_document_url || null,
      id_document_name: body.id_document_name || null,
      id_document_uploaded_at: body.id_document_url ? new Date().toISOString() : null,
      verification_status: body.verification_status || 'unverified',
      consent_identity_check: !!body.consent_identity_check,
      consent_identity_at: body.consent_identity_check ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('container_contractors')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      // Retry without new columns if migration not applied
      if (/column|schema cache/i.test(error.message)) {
        const minimal = {
          profile_id: companyId,
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone,
          id_number: payload.id_number,
          status: payload.status,
          training_status: payload.training_status,
          bank_details: payload.bank_details,
          updated_at: payload.updated_at,
        };
        const retry = await supabase.from('container_contractors').insert(minimal).select('*').single();
        if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
        return NextResponse.json({
          success: true,
          contractor: retry.data,
          warning: 'Run 20260709_contractor_verification.sql for ID document + VerifyNow columns',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, contractor: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of CONTRACTOR_FIELDS) {
      if (body[f] !== undefined) {
        updates[f] = f === 'id_number' && body[f] ? String(body[f]).replace(/\s/g, '') : body[f];
      }
    }
    if (body.id_document_url && !body.id_document_uploaded_at) {
      updates.id_document_uploaded_at = new Date().toISOString();
    }
    if (body.consent_identity_check && !body.consent_identity_at) {
      updates.consent_identity_at = new Date().toISOString();
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_contractors')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, contractor: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('container_contractors').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
