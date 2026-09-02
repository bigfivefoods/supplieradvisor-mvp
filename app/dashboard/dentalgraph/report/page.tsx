'use client';

import { useMemo } from 'react';
import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { DataTable, StatRow } from '@/components/dental/DentalForm';
import { healthSummaryLabel, isInjured } from '@/lib/health/body-map';
import { clinicDiaryMetrics } from '@/lib/services/clinician-portal';
import ManagementReportPanel from '@/components/advisors/ManagementReportPanel';
import { CLINIC_REPORT_STATUS_DIM } from '@/lib/advisors/management-report';

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

  const metrics = useMemo(() => {
    if (!store) return null;
    const to = new Date().toISOString().slice(0, 10);
    const fromD = new Date(to + 'T12:00:00');
    fromD.setDate(fromD.getDate() - 30);
    const from = fromD.toISOString().slice(0, 10);
    return clinicDiaryMetrics(store, from, to, 'dentalgraph');
  }, [store]);

  const softBlocked =
    store?.patients.filter((p) => p.booking_soft_block).length || 0;

  return (
    <DentalgraphWorkbench
      title="Reports"
      titleAccent="slice & dice · pack · trends"
      description="One slicer at the top. Tabs of reports underneath — each list has a graph above it."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">

      <ManagementReportPanel
        advisor="dentalgraph"
        className="mb-6"
        dimensions={[
          ...((store?.staff || []).filter((p) => p.active !== false).length
            ? [
                {
                  key: 'staffId',
                  label: 'Clinician',
                  options: (store?.staff || [])
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

          <StatRow
            items={[
              {
                label: 'Fill rate (30d)',
                value: metrics ? `${metrics.fillRate}%` : '—',
              },
              {
                label: 'Attended / no-show',
                value: metrics
                  ? `${metrics.attended} / ${metrics.noShow}`
                  : '—',
              },
              {
                label: 'Waitlist now',
                value: metrics?.waitlist ?? 0,
              },
              {
                label: 'Soft-blocked patients',
                value: softBlocked,
              },
              {
                label: 'Clinical notes',
                value: injured,
              },
              {
                label: 'Appts today',
                value: Number(summary?.appointmentsToday) || 0,
              },
            ]}
          />
          {metrics ? (
            <DataTable
              headers={[
                'Clinician',
                'Slots',
                'Booked',
                'Fill %',
                'Attended',
                'No-show',
              ]}
              rows={metrics.byClinician.map((c) => ({
                id: c.id,
                cells: [
                  c.name,
                  c.appointments,
                  c.booked,
                  `${c.fill_pct}%`,
                  c.attended,
                  c.no_show,
                ],
              }))}
            />
          ) : null}
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
