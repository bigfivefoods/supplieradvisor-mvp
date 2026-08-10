import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  addStaffRole,
  appointmentBookingCount,
  appointmentsInRange,
  closeStaffEngagement,
  defaultDentalPublicSettings,
  ensureDentalPublicToken,
  getStaffRoleOptions,
  issueDentalPatientPortalToken,
  newId,
  readDentalgraphFromMetadata,
  removeStaffRole,
  renameStaffRole,
  reopenStaffEngagement,
  seedDemoDentalgraph,
  summariseDentalgraph,
  writeDentalgraphToMetadata,
  type DentalAppointment,
  type DentalBooking,
  type DentalPackage,
  type DentalPatient,
  type DentalStaff,
  type DentalPublicSettings,
  type DentalService,
  type DentalgraphStore,
} from '@/lib/dental/dentalgraph';
import { mergeHealthProfile } from '@/lib/health/body-map';
import {
  applyMessageAction,
  threadsForDesk,
  totalUnread,
} from '@/lib/messaging/service-inbox';
import { issueFeedbackPrompt } from '@/lib/services/booking-feedback';
import {
  addMedicalDocument,
  mergeMedicalRecord,
  removeMedicalDocument,
  submitMedicalClaim,
  upsertMedicalClaim,
} from '@/lib/clinic/patient-medical';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  buildServiceMemberInviteLink,
  buildServiceMemberPortalLink,
  defaultShareFlags,
  inviteExpiryIso,
  issueServiceMemberInviteToken,
  mergeInviteFieldsFromRecord,
  serviceMemberInviteEmailHtml,
  serviceMemberInviteEmailText,
} from '@/lib/services/member-invite';

export const runtime = 'nodejs';

type Entity =
  | 'staff'
  | 'patients'
  | 'services'
  | 'packages'
  | 'appointments'
  | 'bookings';

async function loadStore(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    prof?.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  return { meta, store: readDentalgraphFromMetadata(meta) };
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: DentalgraphStore
) {
  const supabase = getSupabaseServer();
  const nextMeta = writeDentalgraphToMetadata(meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

function analysis(store: DentalgraphStore) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  return {
    weekAppointments: appointmentsInRange(
      store,
      today,
      weekEnd.toISOString().slice(0, 10)
    ).map((a) => ({
      ...a,
      booked: appointmentBookingCount(store, a.id),
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const { store } = await loadStore(companyId);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseDentalgraph(store),
      analysis: analysis(store),
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
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'upsert');
    const entity = String(body.entity || '') as Entity;
    const { meta, store } = await loadStore(companyId);
    const now = new Date().toISOString();

    if (action === 'seed_demo') {
      const demo = seedDemoDentalgraph(now, companyId);
      await saveStore(companyId, meta, demo);
      return NextResponse.json({
        success: true,
        store: demo,
        summary: summariseDentalgraph(demo),
        analysis: analysis(demo),
        message: 'Demo dental practice loaded',
      });
    }

    /** Messaging: desk · staff · patients */
    if (
      action.startsWith('message_') ||
      action === 'create_thread' ||
      action === 'post_message' ||
      action === 'mark_read' ||
      action === 'archive_thread'
    ) {
      const result = applyMessageAction(store.threads, body, now);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.threads = result.threads;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
        thread: result.thread,
        threads: threadsForDesk(store.threads),
        unread: totalUnread(store.threads || [], 'desk', 'desk'),
        message: 'Message saved',
      });
    }

    if (action === 'update_settings') {
      const patch = (body.settings || body.record || {}) as Partial<DentalPublicSettings>;
      store.settings = ensureDentalPublicToken(
        {
          ...defaultDentalPublicSettings(companyId),
          ...(store.settings || {}),
          ...patch,
        },
        companyId
      );
      if (body.rotate_token === true) {
        store.settings.public_token = `dg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
        message: 'Website / practice settings updated',
      });
    }

    /** Patient medical chart: docs, medical aid, claims */
    if (
      action === 'medical_update' ||
      action === 'medical_doc_add' ||
      action === 'medical_doc_remove' ||
      action === 'medical_claim_upsert' ||
      action === 'medical_claim_submit'
    ) {
      const patientId = String(body.patient_id || body.id || '');
      const pi = store.patients.findIndex((p) => p.id === patientId);
      if (pi < 0) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
      const patient = store.patients[pi];
      try {
        if (action === 'medical_update') {
          patient.medical = mergeMedicalRecord(
            patient.medical,
            body.medical || body.record || body
          );
        } else if (action === 'medical_doc_add') {
          const doc = (body.document || body.record || body) as Record<
            string,
            unknown
          >;
          patient.medical = addMedicalDocument(
            patient.medical,
            {
              title: String(doc.title || doc.file_name || 'Document'),
              file_name: String(doc.file_name || 'file'),
              url: String(doc.url || ''),
              kind: String(doc.kind || 'other'),
              notes: doc.notes != null ? String(doc.notes) : undefined,
            },
            now
          );
        } else if (action === 'medical_doc_remove') {
          patient.medical = removeMedicalDocument(
            patient.medical,
            String(body.document_id || body.doc_id || '')
          );
        } else if (action === 'medical_claim_upsert') {
          patient.medical = upsertMedicalClaim(
            patient.medical,
            (body.claim || body.record || body) as Record<string, unknown>,
            now
          );
        } else if (action === 'medical_claim_submit') {
          patient.medical = submitMedicalClaim(
            patient.medical,
            String(body.claim_id || body.id || ''),
            now
          );
        }
      } catch (e: unknown) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Medical update failed' },
          { status: 400 }
        );
      }
      patient.updated_at = now;
      store.patients[pi] = patient;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
        patient,
        message: 'Patient medical record updated',
      });
    }

    /** Owner: end current staff engagement and archive to history */
    if (
      action === 'close_staff_engagement' ||
      action === 'end_staff_engagement' ||
      action === 'close_engagement'
    ) {
      const personId = String(body.staffId || body.staff_id || body.id || '');
      const idx = store.staff.findIndex((p) => p.id === personId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
      }
      const endDate = body.end_date
        ? String(body.end_date).slice(0, 10)
        : now.slice(0, 10);
      store.staff[idx] = closeStaffEngagement(store.staff[idx], endDate, {
        note: body.note != null ? String(body.note) : undefined,
        reason: body.reason != null ? String(body.reason) : undefined,
        nowIso: now,
      });
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
        message: 'Staff engagement ended and saved to history',
      });
    }

    /** Owner: rehire / start a new engagement (keeps prior history) */
    if (
      action === 'reopen_staff_engagement' ||
      action === 'rehire_staff' ||
      action === 'rehire'
    ) {
      const personId = String(body.staffId || body.staff_id || body.id || '');
      const idx = store.staff.findIndex((p) => p.id === personId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
      }
      const startDate = body.start_date
        ? String(body.start_date).slice(0, 10)
        : now.slice(0, 10);
      let person = store.staff[idx];
      if (person.active !== false && !person.end_date) {
        const endBefore = body.end_before
          ? String(body.end_before).slice(0, 10)
          : startDate;
        person = closeStaffEngagement(person, endBefore, {
          note: 'Closed before rehire',
          reason: 'rehire',
          nowIso: now,
        });
      }
      store.staff[idx] = reopenStaffEngagement(person, startDate);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
        message: 'Staff engagement reopened',
      });
    }

    /** Owner: manage staff role / skills catalogue */
    if (
      action === 'manage_roles' ||
      action === 'manage_skills' ||
      action === 'staff_roles'
    ) {
      const op = String(body.op || body.operation || 'list');
      if (!store.settings) store.settings = defaultDentalPublicSettings(companyId);
      if (
        !Array.isArray(store.settings.staff_roles) ||
        store.settings.staff_roles.length === 0
      ) {
        store.settings.staff_roles = getStaffRoleOptions(store);
      }

      if (op === 'list') {
        return NextResponse.json({
          success: true,
          roles: getStaffRoleOptions(store),
          store,
          summary: summariseDentalgraph(store),
        });
      }

      if (op === 'add') {
        const result = addStaffRole(
          store,
          String(body.name || body.role || body.skill || '')
        );
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          roles: result.options,
          store,
          summary: summariseDentalgraph(store),
          analysis: analysis(store),
          message: 'Role added',
        });
      }

      if (op === 'rename' || op === 'edit') {
        const result = renameStaffRole(
          store,
          String(body.from || body.old_name || body.old || ''),
          String(body.to || body.new_name || body.name || '')
        );
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          roles: result.options,
          store,
          summary: summariseDentalgraph(store),
          analysis: analysis(store),
          message: 'Role updated',
        });
      }

      if (op === 'remove' || op === 'delete') {
        const result = removeStaffRole(
          store,
          String(body.name || body.role || body.from || ''),
          {
            stripFromStaff:
              body.strip_from_staff === true || body.strip_from_people === true,
          }
        );
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          roles: result.options,
          store,
          summary: summariseDentalgraph(store),
          analysis: analysis(store),
          message: 'Role removed from catalogue',
        });
      }

      return NextResponse.json({ error: 'Unknown role op' }, { status: 400 });
    }

    /** Owner: issue patient portal so they can book open diary slots */
    if (
      action === 'issue_patient_portal' ||
      action === 'issue_member_portal'
    ) {
      const patientId = String(body.patientId || body.patient_id || body.id || '');
      const patient = store.patients.find((p) => p.id === patientId);
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
      patient.portal_token = issueDentalPatientPortalToken(companyId);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        portal_token: patient.portal_token,
        analysis: analysis(store),
        message: 'Patient portal link issued',
      });
    }

    /** Owner: email invite so patient can join the portal */
    if (
      action === 'invite_patient' ||
      action === 'invite_member' ||
      action === 'send_member_invite'
    ) {
      const patientId = String(
        body.patientId || body.patient_id || body.id || ''
      );
      const patient = store.patients.find((p) => p.id === patientId);
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
      const email = String(body.email || patient.email || '')
        .toLowerCase()
        .trim();
      if (!email || !email.includes('@')) {
        return NextResponse.json(
          { error: 'A valid email is required to send a patient invite' },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const defaults = defaultShareFlags('dentalgraph');
      const inviteToken = issueServiceMemberInviteToken(
        'dentalgraph',
        companyId
      );
      if (!patient.portal_token) {
        patient.portal_token = issueDentalPatientPortalToken(companyId);
      }
      patient.email = email;
      patient.invite_token = inviteToken;
      patient.invite_status = 'pending';
      patient.invite_email = email;
      patient.invite_sent_at = nowIso;
      patient.invite_accepted_at = null;
      patient.invite_expires_at = inviteExpiryIso(14);
      patient.share_schedule =
        body.share_schedule !== undefined
          ? body.share_schedule !== false
          : patient.share_schedule !== false;
      patient.share_feedback =
        body.share_feedback !== undefined
          ? body.share_feedback !== false
          : patient.share_feedback !== false;
      patient.share_medical =
        body.share_medical !== undefined
          ? body.share_medical !== false
          : patient.share_medical !== false
            ? true
            : defaults.share_medical === true;
      patient.updated_at = nowIso;

      const supabase = getSupabaseServer();
      const { data: prof } = await supabase
        .from('profiles')
        .select('trading_name, legal_name')
        .eq('id', companyId)
        .maybeSingle();
      const businessName =
        store.settings?.brand_name ||
        prof?.trading_name ||
        prof?.legal_name ||
        'Your practice';
      const invitedBy = String(
        body.invitedBy || body.invited_by || 'Your dental team'
      );
      const inviteLink = buildServiceMemberInviteLink(
        'dentalgraph',
        inviteToken
      );

      let emailWarning: string | undefined;
      try {
        const resend = getResend();
        const { error: emailError } = await resend.emails.send({
          from: getResendFrom(),
          replyTo: getResendReplyTo(),
          to: email,
          subject: `${businessName} invited you to DentalAdvisor®`,
          html: serviceMemberInviteEmailHtml({
            inviteeName: patient.name,
            businessName,
            invitedBy,
            inviteLink,
            module: 'dentalgraph',
          }),
          text: serviceMemberInviteEmailText({
            inviteeName: patient.name,
            businessName,
            invitedBy,
            inviteLink,
            module: 'dentalgraph',
          }),
        });
        if (emailError) {
          emailWarning = `Invite saved but email failed: ${emailError.message}`;
        }
      } catch (emailErr: unknown) {
        const msg =
          emailErr instanceof Error ? emailErr.message : 'Email failed';
        emailWarning = `Invite saved but email failed: ${msg}`;
      }

      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
        invite_token: inviteToken,
        invite_link: inviteLink,
        portal_token: patient.portal_token,
        portal_link: buildServiceMemberPortalLink(
          'dentalgraph',
          patient.portal_token!
        ),
        email_sent: !emailWarning,
        warning: emailWarning,
        message: emailWarning
          ? emailWarning
          : `Patient invite sent to ${email}`,
      });
    }

    if (
      action === 'revoke_member_invite' ||
      action === 'revoke_patient_invite'
    ) {
      const patientId = String(
        body.patientId || body.patient_id || body.id || ''
      );
      const patient = store.patients.find((p) => p.id === patientId);
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
      patient.invite_status = 'revoked';
      patient.invite_token = null;
      patient.invite_expires_at = null;
      patient.updated_at = new Date().toISOString();
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
        message: 'Patient invite revoked',
      });
    }

    if (action === 'delete') {
      const id = String(body.id || '');
      if (!id || !entity) {
        return NextResponse.json(
          { error: 'entity and id required' },
          { status: 400 }
        );
      }
      const list = store[entity] as Array<{ id: string }> | undefined;
      if (!Array.isArray(list)) {
        return NextResponse.json({ error: 'Unknown entity' }, { status: 400 });
      }
      (store as Record<string, unknown>)[entity] = list.filter((r) => r.id !== id);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
      });
    }

    if (action === 'upsert' || action === 'create' || action === 'update') {
      const rec = (body.record || body) as Record<string, unknown>;
      upsert(store, entity, rec, now);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseDentalgraph(store),
        analysis: analysis(store),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[dentalgraph]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function upsert(
  store: DentalgraphStore,
  entity: Entity,
  rec: Record<string, unknown>,
  now: string
) {
  if (entity === 'staff') {
    const id = String(rec.id || newId('stf'));
    const i = store.staff.findIndex((p) => p.id === id);
    const prev = i >= 0 ? store.staff[i] : null;
    const startDate =
      rec.start_date != null && String(rec.start_date).trim()
        ? String(rec.start_date).slice(0, 10)
        : prev?.start_date || now.slice(0, 10);
    let endDate: string | null =
      rec.end_date !== undefined
        ? rec.end_date
          ? String(rec.end_date).slice(0, 10)
          : null
        : prev?.end_date ?? null;
    let history = Array.isArray(prev?.history)
      ? [...(prev!.history || [])]
      : Array.isArray(rec.history)
        ? (rec.history as DentalStaff['history'])
        : [];
    if (endDate && prev && !prev.end_date && startDate) {
      const closed = closeStaffEngagement(
        { ...prev, start_date: startDate, history },
        endDate,
        {
          note:
            rec.ended_note != null ? String(rec.ended_note) : undefined,
          reason:
            rec.ended_reason != null ? String(rec.ended_reason) : undefined,
          nowIso: now,
        }
      );
      history = closed.history || history;
    }
    if (endDate === null && prev?.end_date && rec.end_date !== undefined) {
      history = Array.isArray(prev.history) ? [...prev.history] : history;
    }
    const activeExplicit =
      rec.active !== undefined ? rec.active !== false : undefined;
    const row: DentalStaff = {
      id,
      code: String(rec.code || prev?.code || `ST-${store.staff.length + 1}`),
      name: String(rec.name || prev?.name || 'Staff'),
      email: rec.email != null ? String(rec.email) : prev?.email,
      phone: rec.phone != null ? String(rec.phone) : prev?.phone,
      roles: Array.isArray(rec.roles)
        ? (rec.roles as string[])
        : rec.skills
          ? (rec.skills as string[])
          : prev?.roles || [],
      bio: rec.bio != null ? String(rec.bio) : prev?.bio,
      public_bio:
        rec.public_bio != null ? String(rec.public_bio) : prev?.public_bio,
      photo_url:
        rec.photo_url !== undefined
          ? rec.photo_url
            ? String(rec.photo_url)
            : undefined
          : prev?.photo_url,
      rate_zar:
        rec.rate_zar !== undefined
          ? rec.rate_zar === null || rec.rate_zar === ''
            ? null
            : Number(rec.rate_zar)
          : prev?.rate_zar ?? null,
      rate_basis:
        rec.rate_basis !== undefined
          ? rec.rate_basis
            ? String(rec.rate_basis)
            : null
          : prev?.rate_basis ?? 'per_session',
      rate_note:
        rec.rate_note != null ? String(rec.rate_note) : prev?.rate_note,
      start_date: startDate,
      end_date: endDate,
      contracts: Array.isArray(rec.contracts)
        ? (rec.contracts as DentalStaff['contracts'])
        : prev?.contracts || [],
      history,
      portal_token:
        rec.portal_token !== undefined
          ? rec.portal_token
            ? String(rec.portal_token)
            : null
          : prev?.portal_token ?? null,
      can_manage:
        rec.can_manage !== undefined
          ? rec.can_manage !== false
          : prev?.can_manage !== false,
      active:
        activeExplicit !== undefined
          ? activeExplicit
          : endDate
            ? false
            : prev?.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.staff[i] = row;
    else store.staff.push(row);
  } else if (entity === 'patients') {
    const id = String(rec.id || newId('dpt'));
    const i = store.patients.findIndex((p) => p.id === id);
    const prev = i >= 0 ? store.patients[i] : null;
    const clinicalPatch =
      rec.clinical !== undefined ||
      rec.health !== undefined ||
      rec.injured !== undefined ||
      rec.injury_areas !== undefined ||
      rec.injury_notes !== undefined ||
      rec.injury_status !== undefined ||
      rec.injury_side !== undefined ||
      rec.injury_onset !== undefined ||
      rec.training_modifications !== undefined ||
      rec.goals !== undefined ||
      rec.pain_score !== undefined ||
      rec.treatment_goals !== undefined ||
      rec.contraindications !== undefined ||
      rec.functional_limitations !== undefined ||
      rec.progress_notes !== undefined ||
      rec.diagnosis_notes !== undefined;
    const clinical = clinicalPatch
      ? mergeHealthProfile(
          prev?.clinical ||
            (prev?.diagnosis_notes
              ? { diagnosis_notes: prev.diagnosis_notes }
              : undefined),
          {
            ...rec,
            health: rec.clinical || rec.health || rec,
            diagnosis_notes:
              rec.diagnosis_notes ??
              (rec.clinical as { diagnosis_notes?: string } | undefined)
                ?.diagnosis_notes,
          },
          {
            now,
            updatedBy: String(rec.clinical_updated_by || rec.health_updated_by || 'desk'),
          }
        )
      : prev?.clinical;
    const row: DentalPatient = {
      id,
      code: String(rec.code || prev?.code || `DP-${store.patients.length + 1}`),
      name: String(rec.name || prev?.name || 'Patient'),
      email:
        rec.email !== undefined
          ? rec.email
            ? String(rec.email)
            : undefined
          : prev?.email,
      phone:
        rec.phone !== undefined
          ? rec.phone
            ? String(rec.phone)
            : undefined
          : prev?.phone,
      photo_url:
        rec.photo_url !== undefined
          ? rec.photo_url
            ? String(rec.photo_url)
            : undefined
          : prev?.photo_url,
      portal_token:
        rec.portal_token !== undefined
          ? rec.portal_token
            ? String(rec.portal_token)
            : null
          : prev?.portal_token ?? null,
      ...mergeInviteFieldsFromRecord(prev, rec as Record<string, unknown>),
      share_schedule:
        rec.share_schedule !== undefined
          ? rec.share_schedule !== false
          : prev?.share_schedule !== false,
      share_feedback:
        rec.share_feedback !== undefined
          ? rec.share_feedback !== false
          : prev?.share_feedback !== false,
      share_medical:
        rec.share_medical !== undefined
          ? rec.share_medical !== false
          : prev?.share_medical !== false,
      status: String(rec.membership_status || rec.status || prev?.status || 'active'),
      staff_id:
        rec.staff_id !== undefined
          ? rec.staff_id
            ? String(rec.staff_id)
            : null
          : prev?.staff_id ?? null,
      package_id:
        rec.package_id !== undefined
          ? rec.package_id
            ? String(rec.package_id)
            : null
          : prev?.package_id ?? null,
      diagnosis_notes:
        clinical?.diagnosis_notes ||
        (rec.diagnosis_notes !== undefined
          ? String(rec.diagnosis_notes)
          : prev?.diagnosis_notes),
      emergency_contact:
        rec.emergency_contact !== undefined
          ? rec.emergency_contact
            ? String(rec.emergency_contact)
            : undefined
          : prev?.emergency_contact,
      notes:
        rec.notes !== undefined
          ? rec.notes
            ? String(rec.notes)
            : undefined
          : prev?.notes,
      clinical,
      medical:
        rec.medical !== undefined
          ? mergeMedicalRecord(prev?.medical, rec.medical)
          : prev?.medical,
      start_date:
        rec.start_date !== undefined
          ? rec.start_date
            ? String(rec.start_date).slice(0, 10)
            : null
          : prev?.start_date || now.slice(0, 10),
      active: rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    if (i >= 0) store.patients[i] = row;
    else store.patients.push(row);
  } else if (entity === 'services') {
    const id = String(rec.id || newId('svc'));
    const i = store.services.findIndex((s) => s.id === id);
    const prev = i >= 0 ? store.services[i] : null;
    const row: DentalService = {
      id,
      code: String(rec.code || prev?.code || `S-${store.services.length + 1}`),
      name: String(rec.name || prev?.name || 'Service'),
      default_duration_min:
        rec.default_duration_min != null
          ? Number(rec.default_duration_min)
          : prev?.default_duration_min ?? 45,
      price_zar:
        rec.price_zar != null ? Number(rec.price_zar) : prev?.price_zar ?? 0,
      description:
        rec.description != null ? String(rec.description) : prev?.description,
      active: rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.services[i] = row;
    else store.services.push(row);
  } else if (entity === 'packages') {
    const id = String(rec.id || newId('pkg'));
    const i = store.packages.findIndex((p) => p.id === id);
    const prev = i >= 0 ? store.packages[i] : null;
    const row: DentalPackage = {
      id,
      code: String(rec.code || prev?.code || `PK-${store.packages.length + 1}`),
      name: String(rec.name || prev?.name || 'Package'),
      sessions_total:
        rec.sessions_total != null
          ? Number(rec.sessions_total)
          : prev?.sessions_total ?? 6,
      price_zar:
        rec.price_zar != null ? Number(rec.price_zar) : prev?.price_zar ?? 0,
      description:
        rec.description != null ? String(rec.description) : prev?.description,
      active: rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.packages[i] = row;
    else store.packages.push(row);
  } else if (entity === 'appointments') {
    const id = String(rec.id || newId('apt'));
    const i = store.appointments.findIndex((a) => a.id === id);
    const prev = i >= 0 ? store.appointments[i] : null;
    const row: DentalAppointment = {
      id,
      service_id: String(rec.service_id || prev?.service_id || ''),
      staff_id:
        rec.staff_id != null
          ? String(rec.staff_id) || null
          : prev?.staff_id ?? null,
      date: String(rec.date || prev?.date || now.slice(0, 10)).slice(0, 10),
      start_time: String(rec.start_time || prev?.start_time || '09:00'),
      end_time:
        rec.end_time != null ? String(rec.end_time) : prev?.end_time ?? null,
      duration_min:
        rec.duration_min != null
          ? Number(rec.duration_min)
          : prev?.duration_min ?? 45,
      location: rec.location != null ? String(rec.location) : prev?.location,
      status: (rec.status as DentalAppointment['status']) || prev?.status || 'scheduled',
      public: rec.public !== undefined ? rec.public === true : prev?.public === true,
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      public_notes:
        rec.public_notes != null ? String(rec.public_notes) : prev?.public_notes,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.appointments[i] = row;
    else store.appointments.push(row);
  } else if (entity === 'bookings') {
    const id = String(rec.id || newId('bkg'));
    const i = store.bookings.findIndex((b) => b.id === id);
    const prev = i >= 0 ? store.bookings[i] : null;
    let row: DentalBooking = {
      id,
      appointment_id: String(
        rec.appointment_id || prev?.appointment_id || ''
      ),
      patient_id: String(rec.patient_id || prev?.patient_id || ''),
      status: (rec.status as DentalBooking['status']) || prev?.status || 'booked',
      booked_at: prev?.booked_at || now,
      source: rec.source != null ? String(rec.source) : prev?.source || 'desk',
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      feedback_token: prev?.feedback_token ?? null,
      feedback_requested_at: prev?.feedback_requested_at ?? null,
      feedback_submitted_at: prev?.feedback_submitted_at ?? null,
      feedback_id: prev?.feedback_id ?? null,
    };
    if (row.status === 'attended') {
      row = issueFeedbackPrompt(row, now);
    }
    if (i >= 0) store.bookings[i] = row;
    else store.bookings.push(row);
  }
}
