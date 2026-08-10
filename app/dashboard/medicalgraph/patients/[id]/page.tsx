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
import { healthSummaryLabel } from '@/lib/health/body-map';

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
          />
        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
