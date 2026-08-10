'use client';

import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { DataTable, StatRow } from '@/components/clinic/MedicalForm';
import { healthSummaryLabel, isInjured } from '@/lib/health/body-map';

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

  return (
    <MedicalgraphWorkbench
      title="Reports"
      titleAccent="clinic pulse"
      description="Practitioner load, injury awareness, patient book, and this week’s diary utilisation."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
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
