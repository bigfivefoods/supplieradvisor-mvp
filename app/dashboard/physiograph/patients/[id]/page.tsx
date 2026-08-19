'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { PatientMedicalChart } from '@/components/clinic/PatientMedicalChart';
import { AdvisorTreatmentPlanPanel } from '@/components/services/AdvisorTreatmentPlanPanel';
import { PatientRecordSharePanel } from '@/components/services/PatientRecordSharePanel';
import { PatientFollowUpDesk } from '@/components/clinic/PatientFollowUpDesk';
import { PatientAilmentDesk } from '@/components/clinic/PatientAilmentDesk';
import { AdvisorProfileShare } from '@/components/advisors/AdvisorProfileShare';
import { healthSummaryLabel } from '@/lib/health/body-map';

export default function PhysioPatientRecordPage() {
  const { id } = useParams() as { id: string };
  const search = useSearchParams();
  const { companyId, store, loading, saving, post, load } = usePhysiograph();

  const patient = useMemo(
    () => store?.patients.find((p) => p.id === id),
    [store, id]
  );
  const prac = store?.practitioners.find(
    (p) => p.id === patient?.practitioner_id
  );

  const appointments = useMemo(() => {
    if (!store || !patient) return [];
    const bookedApptIds = new Set(
      store.bookings
        .filter((b) => b.patient_id === patient.id && b.status !== 'cancelled')
        .map((b) => b.appointment_id)
    );
    return store.appointments
      .filter((a) => bookedApptIds.has(a.id) || a.date >= new Date().toISOString().slice(0, 10))
      .slice()
      .sort((a, b) =>
        a.date === b.date
          ? a.start_time.localeCompare(b.start_time)
          : b.date.localeCompare(a.date)
      )
      .slice(0, 40)
      .map((a) => {
        const svc = store.services.find((s) => s.id === a.service_id);
        const p = store.practitioners.find((x) => x.id === a.practitioner_id);
        return {
          id: a.id,
          label: `${a.date} ${a.start_time} · ${svc?.name || 'Visit'}${
            p ? ` · ${p.name}` : ''
          }`,
        };
      });
  }, [store, patient]);

  const practitioners = useMemo(
    () =>
      (store?.practitioners || []).map((p) => ({
        id: p.id,
        label: p.name,
      })),
    [store]
  );

  return (
    <PhysiographWorkbench
      title={patient?.name || 'Patient record'}
      titleAccent="medical chart"
      description="Demographics, rehab, medical aid, attachments, and scheme submissions for this patient."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : !patient ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm dark:border-rose-800 dark:bg-rose-950/40">
          Patient not found.{' '}
          <Link
            href="/dashboard/physiograph/patients"
            className="font-bold text-teal-700 dark:text-teal-300"
          >
            Back to patients
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-[12px] text-slate-600 dark:text-slate-300">
            <span>
              <strong>Code:</strong> {patient.code}
            </span>
            <span>
              <strong>Status:</strong> {patient.status || '—'}
            </span>
            <span>
              <strong>Practitioner:</strong> {prac?.name || '—'}
            </span>
            <span>
              <strong>Clinical:</strong>{' '}
              {healthSummaryLabel(patient.clinical)}
            </span>
            {patient.email ? (
              <span>
                <strong>Email:</strong> {patient.email}
              </span>
            ) : null}
            {patient.phone ? (
              <span>
                <strong>Phone:</strong> {patient.phone}
              </span>
            ) : null}
          </div>
          
          {(patient.client_notes?.length ||
            patient.shared_movements?.some(
              (m) => String(m.status || 'active') === 'active'
            )) ? (
            <section className="rounded-3xl border border-teal-200 bg-white p-4 space-y-3 dark:border-teal-800 dark:bg-teal-950/20">
              <h3 className="text-sm font-black text-teal-950 dark:text-teal-50">
                Shared with this client
              </h3>
              {(patient.client_notes || []).slice(0, 6).map((n) => (
                <p
                  key={n.id}
                  className="whitespace-pre-wrap rounded-xl border border-teal-100 px-3 py-2 text-[12px] dark:border-teal-800"
                >
                  {n.body}
                  <span className="mt-1 block text-[10px] text-slate-400">
                    {String(n.created_at).slice(0, 10)}
                    {n.author_name ? ` · ${n.author_name}` : ''}
                  </span>
                </p>
              ))}
              {(patient.shared_movements || [])
                .filter((m) => String(m.status || 'active') === 'active')
                .slice(0, 8)
                .map((m) => (
                  <p
                    key={m.id}
                    className="rounded-xl border border-teal-100 px-3 py-2 text-[12px] dark:border-teal-800"
                  >
                    <strong>{m.movement_name}</strong>
                    {` ${[
                      m.sets && `${m.sets} sets`,
                      m.reps && `${m.reps} reps`,
                      m.frequency,
                    ]
                      .filter(Boolean)
                      .join(' · ')}`.trimEnd()}
                  </p>
                ))}
            </section>
          ) : null}

          <PatientAilmentDesk
            module="physio"
            patientId={patient.id}
            clinical={patient.clinical}
            diagnosisNotes={patient.diagnosis_notes}
            post={post}
            saving={saving}
            accent="teal"
            onSaved={() => {
              void load();
            }}
          />

          <AdvisorTreatmentPlanPanel
            personId={patient.id}
            personLabel={patient.name}
            plans={store.treatment_plans || []}
            services={store.services.map((s) => ({ id: s.id, name: s.name }))}
            appointments={store.appointments}
            bookings={store.bookings}
            accentClass="border-teal-200"
            post={async (body) => {
              await post(body);
            }}
            onRefresh={() => {
              void load();
            }}
          />

          <PatientFollowUpDesk
            patientId={patient.id}
            followUps={patient.follow_ups}
            post={post}
            saving={saving}
            accentClass="border-teal-200"
          />
          <PatientRecordSharePanel
            personId={patient.id}
            personName={patient.name}
            fromCompanyId={companyId}
            fromModule="physio"
            grants={store.record_shares || []}
            practitioners={(store.practitioners || [])
              .filter((p) => p.active !== false)
              .map((p) => ({ id: p.id, name: p.name }))}
            consentOnFile={Boolean(patient.popia_consent_at)}
            disabled={saving}
            onChange={async (next) => {
              await post({
                action: 'save_record_shares',
                record_shares: next,
              });
            }}
          />
          <AdvisorProfileShare
            companyId={companyId}
            personId={patient.id}
            kind="physio"
            personName={patient.name}
            email={patient.email}
            platformUserId={patient.platform_user_id}
          />

          <PatientMedicalChart
            companyId={companyId}
            patientId={patient.id}
            patientName={patient.name}
            medical={patient.medical}
            accent="teal"
            appointments={appointments}
            practitioners={practitioners}
            defaultAppointmentId={search.get('appointment')}
            defaultBookingId={search.get('booking')}
            defaultPractitionerId={
              search.get('practitioner') || patient.practitioner_id || null
            }
            post={post}
            saving={saving}
            scriptNoun="Rehab"
            scriptKind="rehab"
            claimPackHref={(claimId) =>
              `/api/clinic/medical-aid-claims/pack?companyId=${companyId}&module=physiograph&patientId=${encodeURIComponent(patient.id)}&claimId=${encodeURIComponent(claimId)}`
            }
          />
        </div>
      )}
    </PhysiographWorkbench>
  );
}
