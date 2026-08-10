'use client';

import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { DataTable, StatRow } from '@/components/dental/DentalForm';
import { healthSummaryLabel, isInjured } from '@/lib/health/body-map';

export default function ReportPage() {
  const { store, loading, summary, analysis } = useDentalgraph();
  const week =
    (analysis?.weekAppointments as Array<{
      id: string;
      date: string;
      start_time: string;
      service_id: string;
      staff_id?: string | null;
      status: string;
      booked: number;
    }>) || [];
  const injured =
    store?.patients.filter((p) => isInjured(p.clinical)).length || 0;

  return (
    <DentalgraphWorkbench
      title="Reports"
      titleAccent="practice pulse"
      description="Clinician load, oral health awareness, patient book, and this week’s diary utilisation."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Clinicians',
                value: Number(summary?.staffCount) || 0,
              },
              {
                label: 'Active patients',
                value: Number(summary?.activePatients) || 0,
              },
              {
                label: 'Active clinical notes',
                value: injured,
              },
              {
                label: 'Appts today',
                value: Number(summary?.appointmentsToday) || 0,
              },
            ]}
          />
          <DataTable
            headers={['Date', 'Time', 'Service', 'Clinician', 'Booked', 'Status']}
            rows={week.map((a) => {
              const svc = store.services.find((s) => s.id === a.service_id);
              const prac = store.staff.find(
                (p) => p.id === a.staff_id
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
              'Clinician',
            ]}
            rows={store.patients
              .filter((p) => isInjured(p.clinical) || p.clinical?.injury_notes)
              .map((p) => {
                const prac = store.staff.find(
                  (x) => x.id === p.staff_id
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
            headers={['Clinician', 'Roles', 'Rate', 'Patients assigned']}
            rows={store.staff.map((p) => ({
              id: p.id,
              cells: [
                p.name,
                (p.roles || []).join(', ') || '—',
                p.rate_zar != null
                  ? `R${p.rate_zar}/${p.rate_basis || 'session'}`
                  : '—',
                store.patients.filter((x) => x.staff_id === p.id).length,
              ],
            }))}
          />
        </div>
      )}
    </DentalgraphWorkbench>
  );
}
