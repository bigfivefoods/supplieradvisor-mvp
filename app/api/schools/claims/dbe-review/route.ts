import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { sendClaimDecisionEmail } from '@/lib/schools/claim-dbe-email';

/**
 * DBE claim decision:
 *  - GET ?token=  → claim summary for email review page
 *  - POST { token, action, approver_email, notes } → approve | reject
 *  - POST { companyId, claim_id, action, ... } → logged-in DBE review
 */
export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token || token.length < 20) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data: claim, error } = await supabase
      .from('nsnp_claim_packs')
      .select('*')
      .eq('approval_token', token)
      .maybeSingle();
    if (error || !claim) {
      return NextResponse.json(
        { error: 'Invalid or expired approval link' },
        { status: 404 }
      );
    }
    if (
      claim.approval_token_expires_at &&
      new Date(String(claim.approval_token_expires_at)).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: 'This approval link has expired. Ask the school to re-submit or open Claims in the DBE desk.' },
        { status: 410 }
      );
    }

    let schoolName = `School ${claim.school_profile_id}`;
    let emis: string | null = null;
    let district: string | null = null;
    let province: string | null = null;
    if (claim.school_profile_id) {
      const { data: sch } = await supabase
        .from('school_profiles')
        .select('school_name, emis_number, natemis, district, province')
        .eq('id', claim.school_profile_id)
        .maybeSingle();
      if (sch) {
        schoolName = String(sch.school_name || schoolName);
        emis = sch.natemis || sch.emis_number || null;
        district = sch.district != null ? String(sch.district) : null;
        province = sch.province != null ? String(sch.province) : null;
      }
    }

    let agencyName = 'Department of Basic Education';
    let agencyEmail: string | null = null;
    if (claim.agency_profile_id) {
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select('agency_name, contact_email')
        .eq('profile_id', claim.agency_profile_id)
        .maybeSingle();
      if (ag) {
        agencyName = String(ag.agency_name || agencyName);
        agencyEmail = ag.contact_email != null ? String(ag.contact_email) : null;
      }
    }

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        status: claim.status,
        period_from: claim.period_from,
        period_to: claim.period_to,
        meals_served: claim.meals_served,
        days_fed: claim.days_fed,
        claim_amount: claim.claim_amount,
        approved_brand_pct: claim.approved_brand_pct,
        food_spend: claim.food_spend,
        school_declaration: claim.school_declaration,
        school_declaration_name: claim.school_declaration_name,
        dbe_notified_email: claim.dbe_notified_email,
        dbe_approver_email: claim.dbe_approver_email,
        dbe_approved_at: claim.dbe_approved_at,
        rejection_reason: claim.rejection_reason,
      },
      school: { name: schoolName, emis, district, province },
      agency: { name: agencyName, email: agencyEmail },
      can_decide: ['submitted', 'under_review'].includes(String(claim.status)),
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
    const action = String(body.action || '').toLowerCase();
    if (!['approve', 'reject', 'paid'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be approve | reject | paid' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const token = String(body.token || '').trim();
    const companyId = Number(body.companyId);
    const claimId = Number(body.claim_id);
    const notes = body.notes != null ? String(body.notes) : null;
    const approverEmail = String(body.approver_email || body.email || '')
      .trim()
      .toLowerCase();

    let claim: Record<string, unknown> | null = null;

    if (token) {
      const { data } = await supabase
        .from('nsnp_claim_packs')
        .select('*')
        .eq('approval_token', token)
        .maybeSingle();
      claim = data as Record<string, unknown> | null;
      if (!claim) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
      }
      if (
        claim.approval_token_expires_at &&
        new Date(String(claim.approval_token_expires_at)).getTime() < Date.now()
      ) {
        return NextResponse.json({ error: 'Token expired' }, { status: 410 });
      }
      // Email link path: require DBE contact email match (strong control)
      if (!approverEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approverEmail)) {
        return NextResponse.json(
          {
            error:
              'Enter the official DBE email address that received this claim notification.',
          },
          { status: 400 }
        );
      }
      const agencyId = Number(claim.agency_profile_id);
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select('contact_email, agency_name, profile_id')
        .eq('profile_id', agencyId)
        .maybeSingle();
      const dbeEmail = String(ag?.contact_email || '')
        .trim()
        .toLowerCase();
      if (!dbeEmail) {
        return NextResponse.json(
          {
            error:
              'DBE contact email is not set on the department profile. Log in as DBE and set Contact email, or review in the Claims inbox.',
          },
          { status: 400 }
        );
      }
      if (approverEmail !== dbeEmail) {
        return NextResponse.json(
          {
            error: `Approver email must match the DBE contact on file (${maskEmail(dbeEmail)}).`,
          },
          { status: 403 }
        );
      }
    } else if (Number.isFinite(companyId) && Number.isFinite(claimId)) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, contact_email, agency_name')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!ag) {
        return NextResponse.json(
          { error: 'Only DBE can review claims in-app' },
          { status: 403 }
        );
      }
      if (!approverEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approverEmail)) {
        return NextResponse.json(
          {
            error:
              'Enter your official DBE email to confirm this approval decision.',
          },
          { status: 400 }
        );
      }
      const { data } = await supabase
        .from('nsnp_claim_packs')
        .select('*')
        .eq('id', claimId)
        .eq('agency_profile_id', companyId)
        .maybeSingle();
      claim = data as Record<string, unknown> | null;
      if (!claim) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      }
    } else {
      return NextResponse.json(
        { error: 'token or companyId+claim_id required' },
        { status: 400 }
      );
    }

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const current = String(claim.status || '');
    if (action === 'paid' && current !== 'approved') {
      return NextResponse.json(
        { error: 'Claim must be approved by DBE before it can be marked paid' },
        { status: 400 }
      );
    }
    if (
      (action === 'approve' || action === 'reject') &&
      !['submitted', 'under_review'].includes(current)
    ) {
      return NextResponse.json(
        {
          error: `Claim is already “${current}” and cannot be ${action}d again from this step`,
        },
        { status: 400 }
      );
    }
    if (action === 'reject' && !notes) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const newStatus =
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'paid';
    const now = new Date().toISOString();
    const prevLog = Array.isArray(claim.audit_log) ? claim.audit_log : [];
    const auditEntry = {
      at: now,
      by: approverEmail,
      action: newStatus,
      note: notes,
      channel: token ? 'email_token' : 'dbe_desk',
    };

    const patch: Record<string, unknown> = {
      status: newStatus,
      reviewed_at: now,
      review_notes: notes,
      reviewed_by: approverEmail,
      dbe_approver_email: approverEmail,
      audit_log: [...prevLog, auditEntry],
      updated_at: now,
    };
    if (action === 'approve') {
      patch.dbe_approved_at = now;
      patch.rejection_reason = null;
      // Consume token after decision
      patch.approval_token = null;
    }
    if (action === 'reject') {
      patch.rejection_reason = notes;
      patch.approval_token = null;
    }

    const { data: updated, error } = await supabase
      .from('nsnp_claim_packs')
      .update(patch)
      .eq('id', Number(claim.id))
      .select('*')
      .single();

    if (error) {
      // Soft fallback if new columns missing
      const { data: retry, error: e2 } = await supabase
        .from('nsnp_claim_packs')
        .update({
          status: newStatus,
          reviewed_at: now,
          review_notes: notes,
          reviewed_by: approverEmail,
          updated_at: now,
        })
        .eq('id', Number(claim.id))
        .select('*')
        .single();
      if (e2) {
        return NextResponse.json({ error: e2.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, claim: retry });
    }

    // Notify school company contact if available
    try {
      const schoolCompanyId = Number(claim.profile_id);
      if (schoolCompanyId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email, trading_name, school_name')
          .eq('id', schoolCompanyId)
          .maybeSingle();
        const schoolEmail = prof?.email ? String(prof.email) : null;
        const schoolName = String(
          prof?.trading_name || `School ${claim.school_profile_id}`
        );
        if (schoolEmail) {
          await sendClaimDecisionEmail({
            to: schoolEmail,
            schoolName,
            decision: newStatus as 'approved' | 'rejected' | 'paid',
            periodFrom: String(claim.period_from),
            periodTo: String(claim.period_to),
            claimAmount: Number(claim.claim_amount || 0),
            reason: notes,
            approverEmail,
          });
        }
      }
    } catch {
      /* soft */
    }

    return NextResponse.json({
      success: true,
      claim: updated,
      message:
        newStatus === 'approved'
          ? 'Claim approved by DBE'
          : newStatus === 'rejected'
            ? 'Claim rejected by DBE'
            : 'Claim marked paid',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function maskEmail(email: string) {
  const [u, d] = email.split('@');
  if (!d) return '***';
  const vis = u.slice(0, 2);
  return `${vis}***@${d}`;
}
