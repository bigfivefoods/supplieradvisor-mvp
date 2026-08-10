'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { PatientMedicalChart } from '@/components/clinic/PatientMedicalChart';
import { healthSummaryLabel } from '@/lib/health/body-map';

export default function DentalPatientRecordPage() {
  const { id } = useParams() as { id: string };
  const { companyId, store, loading, saving, post } = useDentalgraph();

  const patient = useMemo(
    () => store?.patients.find((p) => p.id === id),
    [store, id]
  );
  const clinician = store?.staff.find((p) => p.id === patient?.staff_id);

  return (
    <DentalgraphWorkbench
      title={patient?.name || 'Patient record'}
      titleAccent="medical chart"
      description="Demographics, oral/clinical notes, medical aid, attachments, and scheme submissions for this patient."
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
          <PatientMedicalChart
            companyId={companyId}
            patientId={patient.id}
            patientName={patient.name}
            medical={patient.medical}
            accent="sky"
            post={post}
            saving={saving}
          />
        </div>
      )}
    </DentalgraphWorkbench>
  );
}
