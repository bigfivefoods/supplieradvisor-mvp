import { NextRequest, NextResponse } from 'next/server';
import {
  legacyPrivyFrom,
  requireCompanyAccess,
  requireCompanyRoles,
  ROLES_FINANCE_CRITICAL,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { logActivity } from '@/lib/customers/access';
import {
  insertCreditEvent,
  loadCreditDocuments,
  loadCreditTimeline,
  mapCreditApplication,
  maskCreditApplication,
  maskPrincipalRow,
  revealCreditApplicationSensitive,
} from '@/lib/credit/application';
import { assertCreditStatusTransition } from '@/lib/credit/status';
import { notifyCreditApplicationStatus } from '@/lib/notifications/email-alerts';

async function loadDetail(companyId: number, id: number) {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('credit_applications')
    .select('*')
    .eq('id', id)
    .eq('profile_id', companyId)
    .maybeSingle();
  if (!data) return null;
  const app = mapCreditApplication(data as Record<string, unknown>);
  const [principalsRes, docs, events] = await Promise.all([
    supabase
      .from('credit_application_principals')
      .select('*')
      .eq('profile_id', companyId)
      .eq('application_id', id)
      .order('id', { ascending: true }),
    loadCreditDocuments({ profileId: companyId, applicationId: id }),
    loadCreditTimeline({ profileId: companyId, applicationId: id }),
  ]);
  return {
    application: app,
    principals: (principalsRes.data || []) as Array<Record<string, unknown>>,
    documents: docs,
    timeline: events,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const id = Number(p.id);
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const detail = await loadDetail(companyId, id);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const reveal = request.nextUrl.searchParams.get('reveal') === '1';
    let sensitive: Record<string, unknown> | null = null;
    if (reveal) {
      const roleGate = await requireCompanyRoles(request, companyId, ROLES_FINANCE_CRITICAL, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!roleGate.ok) return roleGate.response;
      const revealed = revealCreditApplicationSensitive({
        application: detail.application,
        principals: detail.principals,
      });
      sensitive = revealed;
      await insertCreditEvent({
        application_id: id,
        profile_id: companyId,
        actor_type: 'supplier_user',
        actor_id: roleGate.userId,
        action: 'reveal_sensitive',
      });
    }

    return NextResponse.json({
      application: maskCreditApplication(detail.application),
      principals: detail.principals.map(maskPrincipalRow),
      documents: detail.documents.map((row) => ({
        id: Number(row.id),
        principal_id: row.principal_id != null ? Number(row.principal_id) : null,
        doc_type: String(row.doc_type || 'other'),
        file_name: row.file_name != null ? String(row.file_name) : null,
        mime_type: row.mime_type != null ? String(row.mime_type) : null,
        size_bytes: row.size_bytes != null ? Number(row.size_bytes) : null,
        sha256: row.sha256 != null ? String(row.sha256) : null,
        created_at: row.created_at != null ? String(row.created_at) : null,
      })),
      timeline: detail.timeline,
      sensitive,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const id = Number(p.id);
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);

    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const detail = await loadDetail(companyId, id);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const action = String(body.action || '');
    const now = new Date().toISOString();

    if (action === 'start_review') {
      const t = assertCreditStatusTransition({ actor: 'supplier', from: detail.application.status, to: 'under_review' });
      if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });

      const { error } = await supabase
        .from('credit_applications')
        .update({ status: 'under_review', updated_at: now })
        .eq('id', id)
        .eq('profile_id', companyId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await insertCreditEvent({
        application_id: id,
        profile_id: companyId,
        actor_type: 'supplier_user',
        actor_id: gate.userId,
        action,
        from_status: detail.application.status,
        to_status: 'under_review',
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'request_info') {
      const note = String(body.note || '').trim().slice(0, 1000);
      if (!note) return NextResponse.json({ error: 'note required' }, { status: 400 });
      const t = assertCreditStatusTransition({ actor: 'supplier', from: detail.application.status, to: 'more_info_needed' });
      if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });

      const { error } = await supabase
        .from('credit_applications')
        .update({ status: 'more_info_needed', info_request: note, updated_at: now })
        .eq('id', id)
        .eq('profile_id', companyId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await insertCreditEvent({
        application_id: id,
        profile_id: companyId,
        actor_type: 'supplier_user',
        actor_id: gate.userId,
        action,
        from_status: detail.application.status,
        to_status: 'more_info_needed',
        note,
      });
      void notifyCreditApplicationStatus({
        profileId: companyId,
        applicationId: id,
        toStatus: 'more_info_needed',
        note,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'approve') {
      const roleGate = await requireCompanyRoles(request, companyId, ROLES_FINANCE_CRITICAL, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!roleGate.ok) return roleGate.response;

      const t = assertCreditStatusTransition({ actor: 'supplier', from: detail.application.status, to: 'approved' });
      if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });

      const approvedLimit = Number(body.approved_limit);
      const approvedTerms = String(body.approved_terms || '').trim().slice(0, 80);
      const reviewDate = String(body.review_date || '').trim();
      if (!Number.isFinite(approvedLimit) || approvedLimit < 0) {
        return NextResponse.json({ error: 'approved_limit must be >= 0' }, { status: 400 });
      }
      if (!approvedTerms) {
        return NextResponse.json({ error: 'approved_terms required' }, { status: 400 });
      }

      const { error } = await supabase
        .from('credit_applications')
        .update({
          status: 'approved',
          approved_limit: approvedLimit,
          approved_terms: approvedTerms,
          review_date: reviewDate ? reviewDate.slice(0, 10) : null,
          decided_at: now,
          decided_by: roleGate.userId,
          updated_at: now,
        })
        .eq('id', id)
        .eq('profile_id', companyId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { error: customerError } = await supabase
        .from('customers')
        .update({
          credit_limit: approvedLimit,
          payment_terms: approvedTerms,
          updated_at: now,
        })
        .eq('id', detail.application.customer_id)
        .eq('profile_id', companyId);
      if (customerError) return NextResponse.json({ error: customerError.message }, { status: 500 });

      await insertCreditEvent({
        application_id: id,
        profile_id: companyId,
        actor_type: 'supplier_user',
        actor_id: roleGate.userId,
        action,
        from_status: detail.application.status,
        to_status: 'approved',
      });

      await logActivity({
        profile_id: companyId,
        actor_user_id: roleGate.userId,
        action: 'credit_application.approved',
        entity_type: 'credit_application',
        entity_id: String(id),
        summary: `Approved credit application #${id}`,
        metadata: {
          approved_limit: approvedLimit,
          approved_terms: approvedTerms,
          customer_id: detail.application.customer_id,
        },
      });

      void notifyCreditApplicationStatus({
        profileId: companyId,
        applicationId: id,
        toStatus: 'approved',
        approvedLimit,
        approvedTerms,
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'decline') {
      const roleGate = await requireCompanyRoles(request, companyId, ROLES_FINANCE_CRITICAL, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!roleGate.ok) return roleGate.response;

      const t = assertCreditStatusTransition({ actor: 'supplier', from: detail.application.status, to: 'declined' });
      if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });

      const reason = String(body.reason || '').trim().slice(0, 1000);
      if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 });

      const { error } = await supabase
        .from('credit_applications')
        .update({
          status: 'declined',
          decision_reason: reason,
          decided_at: now,
          decided_by: roleGate.userId,
          updated_at: now,
        })
        .eq('id', id)
        .eq('profile_id', companyId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await insertCreditEvent({
        application_id: id,
        profile_id: companyId,
        actor_type: 'supplier_user',
        actor_id: roleGate.userId,
        action,
        from_status: detail.application.status,
        to_status: 'declined',
        note: reason,
      });

      void notifyCreditApplicationStatus({
        profileId: companyId,
        applicationId: id,
        toStatus: 'declined',
        note: reason,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
