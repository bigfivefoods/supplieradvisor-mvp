import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, assertSupplierConnection } from '@/lib/suppliers/access';
import { logActivity } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&supplierId=&sharedOnly=
 * List supplier vault docs for buyer book entry or all.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const supplierId = sp.get('supplierId') ? Number(sp.get('supplierId')) : null;
    const sharedOnly = sp.get('sharedOnly') === '1';
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    let q = supabase
      .from('supplier_documents')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(300);
    if (supplierId) q = q.eq('supplier_id', supplierId);
    if (sharedOnly) q = q.eq('visibility', 'shared');

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        documents: [],
        warning: error.message,
        hint: 'Run 20260709_srm_supplier_module.sql',
      });
    }
    return NextResponse.json({ success: true, documents: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST — create document metadata (file upload handled client-side to storage)
 * Body: companyId, privyUserId, supplierId?, title, doc_type, file_url?, description?
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.title) {
      return NextResponse.json({ error: 'companyId and title required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });

    const supabase = getSupabaseServer();
    let supplierProfileId = body.supplier_profile_id || body.supplierProfileId || null;
    if (body.supplier_id || body.supplierId) {
      const { data: s } = await supabase
        .from('srm_suppliers')
        .select('id, linked_profile_id')
        .eq('id', Number(body.supplier_id || body.supplierId))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (s?.linked_profile_id) supplierProfileId = s.linked_profile_id;
    }

    const { data, error } = await supabase
      .from('supplier_documents')
      .insert({
        profile_id: companyId,
        supplier_id: body.supplier_id || body.supplierId || null,
        supplier_profile_id: supplierProfileId,
        title: String(body.title).trim(),
        doc_type: body.doc_type || 'other',
        description: body.description || null,
        file_url: body.file_url || null,
        storage_path: body.storage_path || null,
        visibility: body.visibility === 'shared' ? 'shared' : 'private',
        shared_at: body.visibility === 'shared' ? new Date().toISOString() : null,
        content_hash: body.content_hash || null,
        created_by: mem.userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_srm_supplier_module.sql' },
        { status: 500 }
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'supplier.document_create',
      entity_type: 'supplier_documents',
      entity_id: String(data.id),
      summary: `Added supplier document: ${data.title}`,
    });

    return NextResponse.json({ success: true, document: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH — share / unshare / update
 * Sharing requires accepted supplier connection (not suspended).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const docId = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(docId)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });

    const supabase = getSupabaseServer();
    const { data: doc, error: loadErr } = await supabase
      .from('supplier_documents')
      .select('*')
      .eq('id', docId)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (loadErr || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.doc_type !== undefined) updates.doc_type = body.doc_type;
    if (body.file_url !== undefined) updates.file_url = body.file_url;
    if (body.version !== undefined) updates.version = body.version;
    if (body.content_hash !== undefined) {
      updates.content_hash = body.content_hash;
      // content change bumps version when shared (realtime signal)
      if (doc.visibility === 'shared') {
        updates.version = Number(doc.version || 1) + 1;
        updates.shared_at = new Date().toISOString();
      }
    }

    if (body.visibility === 'shared' || body.action === 'share') {
      if (!doc.supplier_profile_id) {
        return NextResponse.json(
          { error: 'Link a platform supplier before sharing' },
          { status: 400 }
        );
      }
      const conn = await assertSupplierConnection(companyId, Number(doc.supplier_profile_id));
      if (!conn.ok) {
        return NextResponse.json({ error: conn.error }, { status: conn.status });
      }
      updates.visibility = 'shared';
      updates.shared_at = new Date().toISOString();
    } else if (body.visibility === 'private' || body.action === 'unshare') {
      updates.visibility = 'private';
      updates.shared_at = null;
    }

    const { data, error } = await supabase
      .from('supplier_documents')
      .update(updates)
      .eq('id', docId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action:
        updates.visibility === 'shared'
          ? 'supplier.document_share'
          : updates.visibility === 'private'
            ? 'supplier.document_unshare'
            : 'supplier.document_update',
      entity_type: 'supplier_documents',
      entity_id: String(docId),
      summary: `Updated supplier document ${doc.title}`,
      metadata: { visibility: data.visibility, version: data.version },
    });

    return NextResponse.json({ success: true, document: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
