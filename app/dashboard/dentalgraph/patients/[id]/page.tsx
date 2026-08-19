'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { PatientMedicalChart } from '@/components/clinic/PatientMedicalChart';
import { AdvisorTreatmentPlanPanel } from '@/components/services/AdvisorTreatmentPlanPanel';
import { PatientRecordSharePanel } from '@/components/services/PatientRecordSharePanel';
import { PatientFollowUpDesk } from '@/components/clinic/PatientFollowUpDesk';
import { PatientAilmentDesk } from '@/components/clinic/PatientAilmentDesk';
import { AdvisorProfileShare } from '@/components/advisors/AdvisorProfileShare';
import { healthSummaryLabel } from '@/lib/health/body-map';

export default function DentalPatientRecordPage() {
  const { id } = useParams() as { id: string };
  const search = useSearchParams();
  const { companyId, store, loading, saving, post, load } = useDentalgraph();

  const patient = useMemo(
    () => store?.patients.find((p) => p.id === id),
    [store, id]
  );
  const clinician = store?.staff.find((p) => p.id === patient?.staff_id);

  const appointments = useMemo(() => {
    if (!store || !patient) return [];
    const bookedApptIds = new Set(
      store.bookings
        .filter((b) => b.patient_id === patient.id && b.status !== 'cancelled')
        .map((b) => b.appointment_id)
    );
    return store.appointments
      .filter(
        (a) =>
          bookedApptIds.has(a.id) ||
          a.date >= new Date().toISOString().slice(0, 10)
      )
      .slice()
      .sort((a, b) =>
        a.date === b.date
          ? a.start_time.localeCompare(b.start_time)
          : b.date.localeCompare(a.date)
      )
      .slice(0, 40)
      .map((a) => {
        const svc = store.services.find((s) => s.id === a.service_id);
        const s = store.staff.find((x) => x.id === a.staff_id);
        return {
          id: a.id,
          label: `${a.date} ${a.start_time} · ${svc?.name || 'Visit'}${
            s ? ` · ${s.name}` : ''
          }`,
        };
      });
  }, [store, patient]);

  const practitioners = useMemo(
    () =>
      (store?.staff || []).map((p) => ({
        id: p.id,
        label: p.name,
      })),
    [store]
  );

  return (
    <DentalgraphWorkbench
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
            href="/dashboard/dentalgraph/patients"
            className="font-bold text-sky-700 dark:text-sky-300"
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
              <strong>Clinician:</strong> {clinician?.name || '—'}
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
          
          <PatientAilmentDesk
            module="dental"
            patientId={patient.id}
            clinical={patient.clinical}
            diagnosisNotes={patient.diagnosis_notes}
            post={post}
            saving={saving}
            accent="sky"
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
            accentClass="border-sky-200"
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
            accentClass="border-sky-200"
          />
          <PatientRecordSharePanel
            personId={patient.id}
            personName={patient.name}
            fromCompanyId={companyId}
            fromModule="dental"
            grants={store.record_shares || []}
            practitioners={(store.staff || [])
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
            kind="dental"
            personName={patient.name}
            email={patient.email}
            platformUserId={patient.platform_user_id}
          />

          <PatientMedicalChart
            companyId={companyId}
            patientId={patient.id}
            patientName={patient.name}
            medical={patient.medical}
            accent="sky"
            appointments={appointments}
            practitioners={practitioners}
            defaultAppointmentId={search.get('appointment')}
            defaultBookingId={search.get('booking')}
            defaultPractitionerId={
              search.get('practitioner') || patient.staff_id || null
            }
            post={post}
            saving={saving}
            claimPackHref={(claimId) =>
              `/api/clinic/medical-aid-claims/pack?companyId=${companyId}&module=dentalgraph&patientId=${encodeURIComponent(patient.id)}&claimId=${encodeURIComponent(claimId)}`
            }
          />
        </div>
      )}
    </DentalgraphWorkbench>
  );
}
