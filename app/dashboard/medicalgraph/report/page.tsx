'use client';

import { useMemo } from 'react';
import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { SpecialDatesReport } from '@/components/advisors/SpecialDatesReport';
import { DataTable, StatRow } from '@/components/clinic/MedicalForm';
import { healthSummaryLabel, isInjured } from '@/lib/health/body-map';
import ManagementReportPanel from '@/components/advisors/ManagementReportPanel';
import { CLINIC_REPORT_STATUS_DIM } from '@/lib/advisors/management-report';

export default function ReportPage() {
  const { store, loading, summary, analysis } = useMedicalgraph();
  const week =
    (analysis?.weekAppointments as Array<{
      id: string;
      date: string;
      start_time: string;
      service_id: string;
      practitioner_id?: string | null;
      status: string;
      booked: number;
    }>) || [];
  const injured =
    store?.patients.filter((p) => isInjured(p.clinical)).length || 0;
  const people = useMemo(
    () =>
      (store?.patients || []).map((patient) => ({
        id: patient.id,
        name: patient.name,
        start_date: patient.start_date,
        created_at: patient.created_at,
        active: patient.active,
        coach_id: patient.practitioner_id || null,
        medical: patient.medical,
        family: patient.family,
      })),
    [store?.patients]
  );

  return (
    <MedicalgraphWorkbench
      title="Reports"
      titleAccent="slice & dice · pack · trends"
      description="One slicer at the top. Tabs of reports underneath — each list has a graph above it."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">

      <ManagementReportPanel
        advisor="medicalgraph"
        className="mb-6"
        dimensions={[
          ...((store?.practitioners || []).filter((p) => p.active !== false)
            .length
            ? [
                {
                  key: 'practitionerId',
                  label: 'Clinician',
                  options: (store?.practitioners || [])
                    .filter((p) => p.active !== false)
                    .map((p) => ({ id: p.id, label: p.name })),
                },
              ]
            : []),
          {
            key: 'serviceId',
            label: 'Service',
            options: (store?.services || [])
              .filter((s) => s.active !== false)
              .map((s) => ({ id: s.id, label: s.name })),
          },
          CLINIC_REPORT_STATUS_DIM,
        ]}
      />

          <SpecialDatesReport
            people={people}
            place="practice"
            hrefFor={(row) =>
              `/dashboard/medicalgraph/patients/${encodeURIComponent(row.client_id)}`
            }
            assigneeLabel="Clinician"
            assignees={(store.practitioners || [])
              .filter((person) => person.active !== false)
              .map((person) => ({ id: person.id, name: person.name }))}
          />

          <StatRow
            items={[
              {
                label: 'Practitioners',
                value: Number(summary?.practitionerCount) || 0,
              },
              {
                label: 'Active patients',
                value: Number(summary?.activePatients) || 0,
              },
              {
                label: 'Injured / recovering',
                value: injured,
              },
              {
                label: 'Appts today',
                value: Number(summary?.appointmentsToday) || 0,
              },
            ]}
          />
          <DataTable
            headers={['Date', 'Time', 'Service', 'Practitioner', 'Booked', 'Status']}
            rows={week.map((a) => {
              const svc = store.services.find((s) => s.id === a.service_id);
              const prac = store.practitioners.find(
                (p) => p.id === a.practitioner_id
              );
              return {
                id: a.id,
                cells: [
                  a.date,
                  a.start_time,
                  svc?.name || '—',
                  prac?.name || '—',
                  a.booked,
                  a.status,
                ],
              };
            })}
          />
          <DataTable
            headers={[
              'Patient',
              'Injury / clinical',
              'Pain',
              'Modifications',
              'Practitioner',
            ]}
            rows={store.patients
              .filter((p) => isInjured(p.clinical) || p.clinical?.injury_notes)
              .map((p) => {
                const prac = store.practitioners.find(
                  (x) => x.id === p.practitioner_id
                );
                return {
                  id: p.id,
                  cells: [
                    p.name,
                    healthSummaryLabel(p.clinical),
                    p.clinical?.pain_score != null
                      ? String(p.clinical.pain_score)
                      : '—',
                    (p.clinical?.training_modifications || '—').slice(0, 60),
                    prac?.name || '—',
                  ],
                };
              })}
          />
          <DataTable
            headers={['Practitioner', 'Disciplines', 'Rate', 'Patients assigned']}
            rows={store.practitioners.map((p) => ({
              id: p.id,
              cells: [
                p.name,
                (p.disciplines || []).join(', ') || '—',
                p.rate_zar != null
                  ? `R${p.rate_zar}/${p.rate_basis || 'session'}`
                  : '—',
                store.patients.filter((x) => x.practitioner_id === p.id).length,
              ],
            }))}
          />
        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
