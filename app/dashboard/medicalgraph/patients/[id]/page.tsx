'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { PatientMedicalChart } from '@/components/clinic/PatientMedicalChart';
import { AdvisorTreatmentPlanPanel } from '@/components/services/AdvisorTreatmentPlanPanel';
import { PatientRecordSharePanel } from '@/components/services/PatientRecordSharePanel';
import { PatientFollowUpDesk } from '@/components/clinic/PatientFollowUpDesk';
import { PatientAilmentDesk } from '@/components/clinic/PatientAilmentDesk';
import { AdvisorProfileShare } from '@/components/advisors/AdvisorProfileShare';
import { healthSummaryLabel } from '@/lib/health/body-map';
import { buildPatientVisitHistory } from '@/lib/clinic/visit-history';
import { PatientVisitHistory } from '@/components/clinic/PatientVisitHistory';

export default function MedicalPatientRecordPage() {
  const { id } = useParams() as { id: string };
  const search = useSearchParams();
  const { companyId, store, loading, saving, post, load } = useMedicalgraph();

  const patient = useMemo(
    () => store?.patients.find((p) => p.id === id),
    [store, id]
  );
  const prac = store?.practitioners.find(
    (p) => p.id === patient?.practitioner_id
  );

  const visitHistory = useMemo(() => {
    if (!store || !patient) return [];
    return buildPatientVisitHistory({
      patientId: patient.id,
      bookings: store.bookings,
      appointments: store.appointments,
      services: store.services,
      practitioners: store.practitioners,
      visitNotes: store.visit_notes,
      scripts: patient.medical?.scripts,
      patientFacing: false,
    });
  }, [store, patient]);

  const appointments = useMemo(
    () =>
      visitHistory.map((v) => ({
        id: v.appointment_id,
        label: `${v.date} ${v.start_time} · ${v.service_name}${
          v.practitioner_name ? ` · ${v.practitioner_name}` : ''
        }`,
      })),
    [visitHistory]
  );

  const practitioners = useMemo(
    () =>
      (store?.practitioners || []).map((p) => ({
        id: p.id,
        label: p.name,
      })),
    [store]
  );

  return (
    <MedicalgraphWorkbench
      title={patient?.name || 'Patient record'}
      titleAccent="medical chart"
      description="Demographics, scripts, medical aid, attachments, and scheme submissions for this patient."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : !patient ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm dark:border-rose-800 dark:bg-rose-950/40">
          Patient not found.{' '}
          <Link
            href="/dashboard/medicalgraph/patients"
            className="font-bold text-emerald-700 dark:text-emerald-300"
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
          
          <div className="space-y-2">
            <p className="text-sm font-black text-slate-900 dark:text-white">
              Visit history
            </p>
            <p className="text-[12px] text-slate-500">
              Past and upcoming visits. The patient sees the same history on SA
              Member (without private notes).
            </p>
            <PatientVisitHistory
              visits={visitHistory}
              showPrivate
              emptyLabel="No bookings yet for this patient."
              calendarHref={(v) =>
                `/dashboard/medicalgraph/calendar?appointment=${encodeURIComponent(v.appointment_id)}`
              }
            />
          </div>

          <PatientAilmentDesk
            module="medical"
            patientId={patient.id}
            clinical={patient.clinical}
            diagnosisNotes={patient.diagnosis_notes}
            post={post}
            saving={saving}
            accent="emerald"
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
            accentClass="border-rose-200"
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
            accentClass="border-emerald-200"
          />
          <PatientRecordSharePanel
            personId={patient.id}
            personName={patient.name}
            fromCompanyId={companyId}
            fromModule="medical"
            grants={store.record_shares || []}
            practitioners={(store.practitioners || [])
              .filter((p) => p.active !== false)
              .map((p) => ({ id: p.id, name: p.name }))}
            consentOnFile={Boolean(patient.popia_consent_at)}
            email={patient.email}
            platformUserId={patient.platform_user_id}
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
            kind="medical"
            personName={patient.name}
            email={patient.email}
            platformUserId={patient.platform_user_id}
          />

          <PatientMedicalChart
            companyId={companyId}
            patientId={patient.id}
            patientName={patient.name}
            medical={patient.medical}
            accent="emerald"
            appointments={appointments}
            practitioners={practitioners}
            defaultAppointmentId={search.get('appointment')}
            defaultBookingId={search.get('booking')}
            defaultPractitionerId={
              search.get('practitioner') || patient.practitioner_id || null
            }
            post={post}
            saving={saving}
            claimPackHref={(claimId) =>
              `/api/clinic/medical-aid-claims/pack?companyId=${companyId}&module=medicalgraph&patientId=${encodeURIComponent(patient.id)}&claimId=${encodeURIComponent(claimId)}`
            }
          />
        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
