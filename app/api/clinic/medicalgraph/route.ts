import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  addPractitionerDiscipline,
  appointmentBookingCount,
  appointmentsInRange,
  closePractitionerEngagement,
  defaultPublicSettings,
  ensurePublicToken,
  getDisciplineOptions,
  issuePatientPortalToken,
  newId,
  readMedicalgraphFromMetadata,
  removePractitionerDiscipline,
  renamePractitionerDiscipline,
  reopenPractitionerEngagement,
  seedDemoMedicalgraph,
  summariseMedicalgraph,
  writeMedicalgraphToMetadata,
  type MedicalAppointment,
  type MedicalBooking,
  type MedicalPackage,
  type MedicalPatient,
  type MedicalPractitioner,
  type MedicalPublicSettings,
  type MedicalService,
  type MedicalgraphStore,
} from '@/lib/clinic/medicalgraph';
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
  removePatientScript,
  submitMedicalClaim,
  upsertMedicalClaim,
  upsertPatientScript,
} from '@/lib/clinic/patient-medical';

export const runtime = 'nodejs';

type Entity =
  | 'practitioners'
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
  return { meta, store: readMedicalgraphFromMetadata(meta) };
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: MedicalgraphStore
) {
  const supabase = getSupabaseServer();
  const nextMeta = writeMedicalgraphToMetadata(meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

function analysis(store: MedicalgraphStore) {
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
      summary: summariseMedicalgraph(store),
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
      const demo = seedDemoMedicalgraph(now, companyId);
      await saveStore(companyId, meta, demo);
      return NextResponse.json({
        success: true,
        store: demo,
        summary: summariseMedicalgraph(demo),
        analysis: analysis(demo),
        message: 'Demo clinic loaded',
      });
    }

    /** Messaging: desk · practitioners · patients */
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

      let fanOut: { delivered: number; companyIds: number[] } | undefined;
      if (
        result.thread &&
        (action === 'message_create_thread' ||
          action === 'create_thread' ||
          action === 'message_start' ||
          action === 'message_post' ||
          action === 'post_message' ||
          action === 'message_reply')
      ) {
        try {
          const { fanOutServiceThreadToMemberCompanies } = await import(
            '@/lib/messaging/service-to-company'
          );
          const supabase = getSupabaseServer();
          const { data: prof } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', companyId)
            .maybeSingle();
          const brand =
            store.settings?.brand_name ||
            prof?.trading_name ||
            prof?.legal_name ||
            'Practice';
          fanOut = await fanOutServiceThreadToMemberCompanies({
            gymCompanyId: companyId,
            gymName: String(brand),
            module: 'medicalgraph',
            serviceThread: result.thread,
            people: store.patients || [],
          });
        
          try {
            const { notifyMembersOnServiceThread } = await import(
              '@/lib/messaging/service-message-email'
            );
            const mail = await notifyMembersOnServiceThread({
              thread: result.thread,
              people: store.patients || [],
              brand: String(store.settings?.brand_name || 'Practice'),
              moduleLabel: 'MedicalAdvisor®',
              portalBasePath: '/member/medicalgraph',
            });
            if (mail.emailed > 0) {
              fanOut = {
                delivered: (fanOut?.delivered || 0) + mail.emailed,
                companyIds: fanOut?.companyIds || [],
              };
            }
          } catch (mailErr) {
            console.warn('[medicalgraph] patient email notify failed', mailErr);
          }

        } catch (e) {
          console.warn('[medicalgraph] service→company fan-out failed', e);
        }
      }

      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        thread: result.thread,
        threads: threadsForDesk(store.threads),
        unread: totalUnread(store.threads || [], 'desk', 'desk'),
        fan_out: fanOut,
        message:
          fanOut && fanOut.delivered > 0
            ? `Message saved · delivered to ${fanOut.delivered} member company inbox(es)`
            : 'Message saved',
      });
    }

    if (action === 'update_settings') {
      const patch = (body.settings || body.record || {}) as Partial<MedicalPublicSettings>;
      store.settings = ensurePublicToken(
        {
          ...defaultPublicSettings(companyId),
          ...(store.settings || {}),
          ...patch,
        },
        companyId
      );
      if (body.rotate_token === true) {
        store.settings.public_token = `medg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        message: 'Website / clinic settings updated',
      });
    }

    /** Patient medical chart: docs, medical aid, claims */
    if (
      action === 'medical_update' ||
      action === 'medical_doc_add' ||
      action === 'medical_doc_remove' ||
      action === 'medical_claim_upsert' ||
      action === 'medical_claim_submit' ||
      action === 'medical_script_upsert' ||
      action === 'medical_script_remove'
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
          patient.medical = addMedicalDocument(patient.medical, {
            title: String(doc.title || doc.file_name || 'Document'),
            file_name: String(doc.file_name || 'file'),
            url: String(doc.url || ''),
            kind: String(doc.kind || 'other'),
            notes: doc.notes != null ? String(doc.notes) : undefined,
          }, now);
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
        } else if (action === 'medical_script_upsert') {
          patient.medical = upsertPatientScript(
            patient.medical,
            (body.script || body.record || body) as Record<string, unknown>,
            now
          );
        } else if (action === 'medical_script_remove') {
          patient.medical = removePatientScript(
            patient.medical,
            String(body.script_id || body.id || '')
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
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        patient,
        message: 'Patient medical record updated',
      });
    }

    /** Owner: end current practitioner engagement and archive to history */
    if (
      action === 'close_practitioner_engagement' ||
      action === 'end_practitioner_engagement' ||
      action === 'close_engagement'
    ) {
      const personId = String(body.practitionerId || body.practitioner_id || body.id || '');
      const idx = store.practitioners.findIndex((p) => p.id === personId);
      if (idx < 0) {
        return NextResponse.json(
          { error: 'Practitioner not found' },
          { status: 404 }
        );
      }
      const endDate = body.end_date
        ? String(body.end_date).slice(0, 10)
        : now.slice(0, 10);
      store.practitioners[idx] = closePractitionerEngagement(
        store.practitioners[idx],
        endDate,
        {
          note: body.note != null ? String(body.note) : undefined,
          reason: body.reason != null ? String(body.reason) : undefined,
          nowIso: now,
        }
      );
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        message: 'Practitioner engagement ended and saved to history',
      });
    }

    /** Owner: rehire / start a new engagement (keeps prior history) */
    if (
      action === 'reopen_practitioner_engagement' ||
      action === 'rehire_practitioner' ||
      action === 'rehire'
    ) {
      const personId = String(body.practitionerId || body.practitioner_id || body.id || '');
      const idx = store.practitioners.findIndex((p) => p.id === personId);
      if (idx < 0) {
        return NextResponse.json(
          { error: 'Practitioner not found' },
          { status: 404 }
        );
      }
      const startDate = body.start_date
        ? String(body.start_date).slice(0, 10)
        : now.slice(0, 10);
      let person = store.practitioners[idx];
      if (person.active !== false && !person.end_date) {
        const endBefore = body.end_before
          ? String(body.end_before).slice(0, 10)
          : startDate;
        person = closePractitionerEngagement(person, endBefore, {
          note: 'Closed before rehire',
          reason: 'rehire',
          nowIso: now,
        });
      }
      store.practitioners[idx] = reopenPractitionerEngagement(person, startDate);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        message: 'Practitioner engagement reopened',
      });
    }

    /** Owner: manage practitioner discipline / skills catalogue */
    if (
      action === 'manage_disciplines' ||
      action === 'manage_skills' ||
      action === 'practitioner_disciplines'
    ) {
      const op = String(body.op || body.operation || 'list');
      if (!store.settings) store.settings = defaultPublicSettings(companyId);
      if (
        !Array.isArray(store.settings.practitioner_disciplines) ||
        store.settings.practitioner_disciplines.length === 0
      ) {
        store.settings.practitioner_disciplines = getDisciplineOptions(store);
      }

      if (op === 'list') {
        return NextResponse.json({
          success: true,
          disciplines: getDisciplineOptions(store),
          store,
          summary: summariseMedicalgraph(store),
        });
      }

      if (op === 'add') {
        const result = addPractitionerDiscipline(
          store,
          String(body.name || body.discipline || body.skill || '')
        );
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          disciplines: result.options,
          store,
          summary: summariseMedicalgraph(store),
          analysis: analysis(store),
          message: 'Discipline added',
        });
      }

      if (op === 'rename' || op === 'edit') {
        const result = renamePractitionerDiscipline(
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
          disciplines: result.options,
          store,
          summary: summariseMedicalgraph(store),
          analysis: analysis(store),
          message: 'Discipline updated',
        });
      }

      if (op === 'remove' || op === 'delete') {
        const result = removePractitionerDiscipline(
          store,
          String(body.name || body.discipline || body.from || ''),
          {
            stripFromPractitioners:
              body.strip_from_practitioners === true ||
              body.strip_from_people === true,
          }
        );
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          disciplines: result.options,
          store,
          summary: summariseMedicalgraph(store),
          analysis: analysis(store),
          message: 'Discipline removed from catalogue',
        });
      }

      return NextResponse.json({ error: 'Unknown discipline op' }, { status: 400 });
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
      const portalToken = issuePatientPortalToken(companyId);
      patient.portal_token = portalToken;
      await saveStore(companyId, meta, store);
      void import('@/lib/b2c/directory').then(({ indexBrandPerson }) =>
        indexBrandPerson({
          kind: 'medical',
          companyId,
          companyName: store.settings?.brand_name,
          brand: store.settings?.brand_name,
          refId: patient.id,
          refLabel: patient.name,
          email: patient.email,
          phone: patient.phone,
          portalToken,
          portalPath: `/member/medicalgraph/${encodeURIComponent(portalToken)}`,
        })
      );
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        portal_token: patient.portal_token,
        analysis: analysis(store),
        message: 'Patient portal link issued',
      });
    }

    /** Owner: issue practitioner diary portal */
    if (
      action === 'issue_practitioner_portal' ||
      action === 'issue_staff_portal' ||
      action === 'issue_clinician_portal'
    ) {
      const pracId = String(
        body.practitionerId ||
          body.practitioner_id ||
          body.staffId ||
          body.id ||
          ''
      );
      const person = store.practitioners.find((p) => p.id === pracId);
      if (!person) {
        return NextResponse.json(
          { error: 'Practitioner not found' },
          { status: 404 }
        );
      }
      const { issuePractitionerPortalToken } = await import(
        '@/lib/clinic/medicalgraph'
      );
      person.portal_token = issuePractitionerPortalToken(companyId);
      person.can_manage = true;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        portal_token: person.portal_token,
        analysis: analysis(store),
        message: 'Clinician portal link issued',
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

      if (
        entity === 'appointments' &&
        (body.delete_series === true || body.series === true)
      ) {
        const target = store.appointments.find((a) => a.id === id);
        const seriesId = target?.series_id ? String(target.series_id) : null;
        if (seriesId) {
          const removeIds = new Set(
            store.appointments
              .filter((a) => a.series_id === seriesId)
              .map((a) => a.id)
          );
          store.appointments = store.appointments.filter(
            (a) => !removeIds.has(a.id)
          );
          store.bookings = (store.bookings || []).filter(
            (b) => !removeIds.has(b.appointment_id)
          );
          await saveStore(companyId, meta, store);
          return NextResponse.json({
            success: true,
            store,
            summary: summariseMedicalgraph(store),
            analysis: analysis(store),
            deleted: removeIds.size,
            message: `Deleted ${removeIds.size} appointments in series`,
          });
        }
      }

      (store as Record<string, unknown>)[entity] = list.filter(
        (r) => r.id !== id
      );
      if (entity === 'appointments') {
        store.bookings = (store.bookings || []).filter(
          (b) => b.appointment_id !== id
        );
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
      });
    }

    
    if (action === 'manage_waitlist_queue') {
      const qid = String(body.queue_id || body.id || '');
      const status = String(body.status || 'contacted');
      store.waitlist_queue = store.waitlist_queue || [];
      const q = store.waitlist_queue.find((x) => x.id === qid);
      if (!q) {
        return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
      }
      if (!['contacted', 'booked', 'cancelled', 'waiting'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      q.status = status as typeof q.status;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        message: 'Waitlist updated',
      });
    }

    if (action === 'send_reminders') {
      const { clinicSendReminders } = await import(
        '@/lib/services/clinic-advisor-actions'
      );
      const { sent, skipped } = await clinicSendReminders(
        store,
        {
          moduleLabel: 'MedicalAdvisor®',
          portalPath: 'medicalgraph',
          brandFallback: 'Practice',
        },
        now
      );
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        reminders: { sent, skipped },
        message: `Sent ${sent} reminder${sent === 1 ? '' : 's'}`,
      });
    }

    if (action === 'outcomes') {
      const { clinicOutcomesAndRecalls } = await import(
        '@/lib/services/clinic-advisor-actions'
      );
      const { outcomes, recalls } = clinicOutcomesAndRecalls(store, {
        periodDays: Number(body.period_days) || 30,
        recallAfterDays: Number(body.recall_after_days) || 180,
      });
      return NextResponse.json({ success: true, outcomes, recalls });
    }

    if (action === 'mark_attendance') {
      const { clinicMarkAttendance } = await import(
        '@/lib/services/clinic-advisor-actions'
      );
      const result = await clinicMarkAttendance(store, {
        bookingId: String(body.booking_id || ''),
        status: String(body.status || 'attended'),
        now,
        cfg: {
          moduleLabel: 'MedicalAdvisor®',
          portalPath: 'medicalgraph',
          brandFallback: 'Practice',
        },
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        waitlist_promoted: result.promoted
          ? {
              booking_id: result.promoted.id,
              patient_id: result.promoted.patient_id,
            }
          : null,
        message: result.message,
      });
    }


    if (
      action === 'upsert_visit_note' ||
      action === 'record_outcome' ||
      action === 'upsert_treatment_plan' ||
      action === 'book_from_treatment_plan' ||
      action === 'issue_care_pack'
    ) {
      if (action === 'issue_care_pack') {
        const { issuePack } = await import('@/lib/services/advisor-pack-ledger');
        store.care_packs = store.care_packs || [];
        store.care_packs.unshift(
          issuePack({
            personId: String(body.person_id || body.patient_id || ''),
            label: String(body.label || 'Care pack'),
            sessionsTotal: Number(body.sessions_total) || 6,
            priceZar: body.price_zar != null ? Number(body.price_zar) : null,
            expiresAt: body.expires_at ? String(body.expires_at) : null,
            now,
          })
        );
      } else if (action === 'book_from_treatment_plan') {
        const { clinicBookFromTreatmentPlan } = await import(
          '@/lib/services/clinic-book-from-plan'
        );
        const result = clinicBookFromTreatmentPlan(
          store,
          body as {
            plan_id?: string;
            person_id?: string;
            patient_id?: string;
            family_member_id?: string | null;
          },
          now,
          () => newId('bk')
        );
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status || 400 }
          );
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          store,
          summary: summariseMedicalgraph(store),
          analysis: analysis(store),
          appointment_id: result.appointment_id,
          booking_id: result.booking_id,
          message: result.message,
        });
      } else if (action === 'upsert_visit_note') {
        const { newVisitNote } = await import('@/lib/services/advisor-clinical');
        store.visit_notes = store.visit_notes || [];
        store.visit_notes.unshift(
          newVisitNote({
            person_id: String(body.person_id || body.patient_id || ''),
            body: String(body.body || body.notes || ''),
            booking_id: body.booking_id ? String(body.booking_id) : null,
            appointment_id: body.appointment_id
              ? String(body.appointment_id)
              : null,
            pain_score:
              body.pain_score != null ? Number(body.pain_score) : null,
            function_score:
              body.function_score != null ? Number(body.function_score) : null,
            soap: body.soap,
            now,
          })
        );
      } else if (action === 'record_outcome') {
        const { newOutcomeScore } = await import(
          '@/lib/services/advisor-clinical'
        );
        store.outcome_scores = store.outcome_scores || [];
        store.outcome_scores.unshift(
          newOutcomeScore({
            person_id: String(body.person_id || body.patient_id || ''),
            instrument: String(body.instrument || 'pain_nrs'),
            score: Number(body.score),
            now,
          })
        );
      } else {
        const { newTreatmentPlan } = await import(
          '@/lib/services/advisor-clinical'
        );
        store.treatment_plans = store.treatment_plans || [];
        if (body.id) {
          const i = store.treatment_plans.findIndex(
            (t) => t.id === String(body.id)
          );
          if (i >= 0) {
            store.treatment_plans[i] = {
              ...store.treatment_plans[i],
              title: body.title
                ? String(body.title)
                : store.treatment_plans[i].title,
              goals:
                body.goals != null
                  ? String(body.goals)
                  : store.treatment_plans[i].goals,
              status:
                (body.status as (typeof store.treatment_plans)[0]['status']) ||
                store.treatment_plans[i].status,
              updated_at: now,
            };
          }
        } else {
          store.treatment_plans.unshift(
            newTreatmentPlan({
              person_id: String(body.person_id || body.patient_id || ''),
              title: String(body.title || 'Treatment plan'),
              package_id: body.package_id ? String(body.package_id) : null,
              goals: body.goals ? String(body.goals) : undefined,
              steps: Array.isArray(body.steps) ? body.steps : undefined,
              now,
            })
          );
        }
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
      });
    }

    /** Create one-off or repeating appointment series (daily/weekly/monthly) */
    if (
      action === 'create_appointment_series' ||
      action === 'create_session_series'
    ) {
      const serviceId = String(body.service_id || '');
      const pracId = String(
        body.practitioner_id || body.staff_id || body.clinician_id || ''
      );
      const date = String(body.date || now.slice(0, 10)).slice(0, 10);
      const startTime = String(body.start_time || '09:00').slice(0, 5);
      if (!serviceId) {
        return NextResponse.json(
          { error: 'service_id required' },
          { status: 400 }
        );
      }
      if (!pracId) {
        return NextResponse.json(
          { error: 'practitioner_id required' },
          { status: 400 }
        );
      }
      if (!store.services.find((s) => s.id === serviceId)) {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }
      if (!store.practitioners.find((p) => p.id === pracId)) {
        return NextResponse.json(
          { error: 'Practitioner not found' },
          { status: 404 }
        );
      }

      const { planAppointmentSeries, recurrenceFromRequestBody } =
        await import('@/lib/schedule/appointment-series');
      const recurrence = recurrenceFromRequestBody(
        body as Record<string, unknown>
      );
      const planned = planAppointmentSeries({
        existing: store.appointments,
        template: {
          service_id: serviceId,
          clinician_id: pracId,
          date,
          start_time: startTime,
          duration_min:
            body.duration_min != null ? Number(body.duration_min) : 45,
          end_time: body.end_time != null ? String(body.end_time) : null,
          location: body.location != null ? String(body.location) : undefined,
          public: body.public === true,
          notes: body.notes != null ? String(body.notes) : undefined,
          public_notes:
            body.public_notes != null ? String(body.public_notes) : undefined,
        },
        recurrence,
        clinicianField: 'practitioner_id',
        newId,
        nowIso: now,
      });

      if (!planned.rows.length) {
        return NextResponse.json(
          {
            error:
              planned.conflicts[0]?.message ||
              'Could not schedule any appointments (conflicts)',
            code: 'SERIES_ALL_CONFLICT',
            conflicts: planned.conflicts,
          },
          { status: 409 }
        );
      }

      const created: MedicalAppointment[] = planned.rows.map((r) => ({
        id: r.id,
        service_id: r.service_id,
        practitioner_id: r.practitioner_id ?? pracId,
        date: r.date,
        start_time: r.start_time,
        end_time: r.end_time ?? null,
        duration_min: r.duration_min ?? 45,
        location: r.location,
        status: 'scheduled' as const,
        public: r.public === true,
        notes: r.notes,
        public_notes: r.public_notes,
        series_id: r.series_id ?? null,
        created_at: r.created_at,
      }));
      store.appointments.push(...created);

      const patientId = body.patient_id ? String(body.patient_id) : '';
      const famId = body.family_member_id
        ? String(body.family_member_id)
        : null;
      const bookingsCreated: MedicalBooking[] = [];
      if (patientId && store.patients.find((p) => p.id === patientId)) {
        let famName: string | null = null;
        if (famId) {
          const patient = store.patients.find((p) => p.id === patientId);
          const m = (patient?.family || []).find((f) => f.id === famId);
          famName = m
            ? `${m.name}${m.relationship ? ` (${m.relationship})` : ''}`
            : null;
        }
        for (const apt of created) {
          const b: MedicalBooking = {
            id: newId('bkg'),
            appointment_id: apt.id,
            patient_id: patientId,
            status: 'booked',
            booked_at: now,
            source: 'desk',
            family_member_id: famName ? famId : null,
            family_member_name: famName,
          };
          store.bookings.push(b);
          bookingsCreated.push(b);
        }
      }

      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        created: created.length,
        skipped: planned.conflicts.length,
        conflicts: planned.conflicts,
        series_id: planned.series_id,
        appointments: created,
        bookings: bookingsCreated,
        message:
          created.length > 1
            ? planned.conflicts.length
              ? `Scheduled ${created.length} appointments (${planned.conflicts.length} date(s) skipped for conflicts)`
              : `Scheduled ${created.length} appointments in series`
            : 'Appointment scheduled',
      });
    }

    if (action === 'upsert' || action === 'create' || action === 'update') {
      const rec = (body.record || body) as Record<string, unknown>;

      if (entity === 'appointments') {
        const { findClinicianDiaryConflict } = await import(
          '@/lib/schedule/clinician-diary'
        );
        const aptId = rec.id != null ? String(rec.id) : null;
        const prev = aptId
          ? store.appointments.find((a) => a.id === aptId)
          : null;
        const pracId = String(
          rec.practitioner_id !== undefined
            ? rec.practitioner_id || ''
            : prev?.practitioner_id || ''
        );
        if (pracId) {
          const conflict = findClinicianDiaryConflict({
            appointments: store.appointments,
            clinicianId: pracId,
            clinicianField: 'practitioner_id',
            date: String(rec.date || prev?.date || now.slice(0, 10)),
            start_time: String(
              rec.start_time || prev?.start_time || '09:00'
            ),
            duration_min:
              rec.duration_min != null
                ? Number(rec.duration_min)
                : prev?.duration_min ?? 45,
            end_time:
              rec.end_time !== undefined
                ? rec.end_time
                  ? String(rec.end_time)
                  : null
                : prev?.end_time ?? null,
            excludeId: aptId,
            status: String(rec.status || prev?.status || 'scheduled'),
          });
          if (conflict.conflict) {
            return NextResponse.json(
              {
                error: conflict.message,
                code: 'CLINICIAN_DOUBLE_BOOK',
                conflict,
              },
              { status: 409 }
            );
          }
        }

        const roomLoc = String(
          rec.location !== undefined
            ? rec.location || ''
            : prev?.location || ''
        ).trim();
        if (roomLoc) {
          const { findRoomDiaryConflict } = await import(
            '@/lib/services/clinic-public-calendar'
          );
          const roomConflict = findRoomDiaryConflict({
            appointments: store.appointments,
            room: roomLoc,
            date: String(rec.date || prev?.date || now.slice(0, 10)),
            start_time: String(
              rec.start_time || prev?.start_time || '09:00'
            ),
            duration_min:
              rec.duration_min != null
                ? Number(rec.duration_min)
                : prev?.duration_min ?? 45,
            end_time:
              rec.end_time !== undefined
                ? rec.end_time
                  ? String(rec.end_time)
                  : null
                : prev?.end_time ?? null,
            excludeId: aptId,
          });
          if (roomConflict.conflict) {
            return NextResponse.json(
              {
                error: roomConflict.message,
                code: 'ROOM_DOUBLE_BOOK',
                conflict: roomConflict,
              },
              { status: 409 }
            );
          }
        }

      }

      upsert(store, entity, rec, now);

      let peopleSync: { employeeId: number | null; created?: boolean } | null =
        null;
      if (entity === 'practitioners') {
        const pracId = String(
          rec.id || store.practitioners[store.practitioners.length - 1]?.id || ''
        );
        const person = store.practitioners.find((s) => s.id === pracId);
        if (person) {
          const { syncStoreStaffPersonToHr } = await import(
            '@/lib/hr/sync-service-person'
          );
          peopleSync = await syncStoreStaffPersonToHr({
            companyId,
            source: 'medicalgraph_practitioner',
            person,
          });
        }
      }

      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseMedicalgraph(store),
        analysis: analysis(store),
        people_sync: peopleSync,
        message:
          entity === 'practitioners' && peopleSync?.employeeId
            ? peopleSync.created
              ? 'Practitioner saved and added to People directory'
              : 'Practitioner saved and People record updated'
            : undefined,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[medicalgraph]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function upsert(
  store: MedicalgraphStore,
  entity: Entity,
  rec: Record<string, unknown>,
  now: string
) {
  if (entity === 'practitioners') {
    const id = String(rec.id || newId('prac'));
    const i = store.practitioners.findIndex((p) => p.id === id);
    const prev = i >= 0 ? store.practitioners[i] : null;
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
        ? (rec.history as MedicalPractitioner['history'])
        : [];
    // If owner newly sets an end date on an open engagement, archive to history
    if (endDate && prev && !prev.end_date && startDate) {
      const closed = closePractitionerEngagement(
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
    const row: MedicalPractitioner = {
      id,
      code: String(rec.code || prev?.code || `PR-${store.practitioners.length + 1}`),
      name: String(rec.name || prev?.name || 'Practitioner'),
      email: rec.email != null ? String(rec.email) : prev?.email,
      phone: rec.phone != null ? String(rec.phone) : prev?.phone,
      hr_employee_id:
        rec.hr_employee_id !== undefined
          ? rec.hr_employee_id
            ? Number(rec.hr_employee_id)
            : null
          : prev?.hr_employee_id ?? null,
      disciplines: Array.isArray(rec.disciplines)
        ? (rec.disciplines as string[])
        : rec.skills
          ? (rec.skills as string[])
          : prev?.disciplines || [],
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
        ? (rec.contracts as MedicalPractitioner['contracts'])
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
    if (i >= 0) store.practitioners[i] = row;
    else store.practitioners.push(row);
  } else if (entity === 'patients') {
    const id = String(rec.id || newId('pat'));
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
    const row: MedicalPatient = {
      id,
      code: String(rec.code || prev?.code || `P-${store.patients.length + 1}`),
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
      status: String(rec.membership_status || rec.status || prev?.status || 'active'),
      practitioner_id:
        rec.practitioner_id !== undefined
          ? rec.practitioner_id
            ? String(rec.practitioner_id)
            : null
          : prev?.practitioner_id ?? null,
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
      popia_consent_at:
        rec.popia_consent_at !== undefined
          ? rec.popia_consent_at
            ? String(rec.popia_consent_at)
            : null
          : prev?.popia_consent_at ?? null,
      clinical,
      medical:
        rec.medical !== undefined
          ? mergeMedicalRecord(prev?.medical, rec.medical)
          : prev?.medical,
      identity: prev?.identity,
      family: prev?.family,
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
    const row: MedicalService = {
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
    const row: MedicalPackage = {
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
    const row: MedicalAppointment = {
      id,
      service_id: String(rec.service_id || prev?.service_id || ''),
      practitioner_id:
        rec.practitioner_id != null
          ? String(rec.practitioner_id) || null
          : prev?.practitioner_id ?? null,
      date: String(rec.date || prev?.date || now.slice(0, 10)).slice(0, 10),
      start_time: String(rec.start_time || prev?.start_time || '09:00'),
      end_time:
        rec.end_time != null ? String(rec.end_time) : prev?.end_time ?? null,
      duration_min:
        rec.duration_min != null
          ? Number(rec.duration_min)
          : prev?.duration_min ?? 45,
      location: rec.location != null ? String(rec.location) : prev?.location,
      status: (rec.status as MedicalAppointment['status']) || prev?.status || 'scheduled',
      public: rec.public !== undefined ? rec.public === true : prev?.public === true,
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      public_notes:
        rec.public_notes != null ? String(rec.public_notes) : prev?.public_notes,
      series_id:
        rec.series_id !== undefined
          ? rec.series_id
            ? String(rec.series_id)
            : null
          : prev?.series_id ?? null,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.appointments[i] = row;
    else store.appointments.push(row);
  } else if (entity === 'bookings') {
    const id = String(rec.id || newId('bkg'));
    const i = store.bookings.findIndex((b) => b.id === id);
    const prev = i >= 0 ? store.bookings[i] : null;
    const patientId = String(rec.patient_id || prev?.patient_id || '');
    const patient = store.patients.find((p) => p.id === patientId);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveBookingFamilyFields, notifyPromotedWaitlist } =
      require('@/lib/services/clinic-advisor-actions') as typeof import('@/lib/services/clinic-advisor-actions');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { promoteNextWaitlist } =
      require('@/lib/services/advisor-booking') as typeof import('@/lib/services/advisor-booking');
    const fam = resolveBookingFamilyFields(patient, rec, prev || null);
    const nextStatus =
      (rec.status as MedicalBooking['status']) || prev?.status || 'booked';
    let row: MedicalBooking = {
      id,
      appointment_id: String(
        rec.appointment_id || prev?.appointment_id || ''
      ),
      patient_id: patientId,
      status: nextStatus,
      booked_at: prev?.booked_at || now,
      source: rec.source != null ? String(rec.source) : prev?.source || 'desk',
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      family_member_id: fam.family_member_id,
      family_member_name: fam.family_member_name,
      reminded_at: prev?.reminded_at ?? null,
      reminder_count: prev?.reminder_count,
      waitlist_offered_at: prev?.waitlist_offered_at ?? null,
      waitlist_accepted_at: prev?.waitlist_accepted_at ?? null,
      feedback_token: prev?.feedback_token ?? null,
      feedback_requested_at: prev?.feedback_requested_at ?? null,
      feedback_submitted_at: prev?.feedback_submitted_at ?? null,
      feedback_id: prev?.feedback_id ?? null,
    };
    if (
      prev &&
      prev.status !== 'cancelled' &&
      nextStatus === 'cancelled' &&
      row.appointment_id
    ) {
      const promoted = promoteNextWaitlist(
        store.bookings,
        (b) => b.appointment_id === row.appointment_id && b.id !== row.id,
        now
      );
      if (promoted) {
        void notifyPromotedWaitlist(store, promoted, {
          moduleLabel: 'MedicalAdvisor®',
          portalPath: 'medicalgraph',
          brandFallback: 'Practice',
        });
      }
    }
    if (row.status === 'attended') {
      row = issueFeedbackPrompt(row, now);
    }
    if (i >= 0) store.bookings[i] = row;
    else store.bookings.push(row);
  }
}
