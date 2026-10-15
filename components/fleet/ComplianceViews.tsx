'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { centreRows, centreSummary, exportRows, monthAgenda, monthTitle, type CentreRow } from '@/lib/fleet/compliance-centre';
import { complianceKindLabel } from '@/lib/fleet/labels';
import { isAssignable } from '@/lib/fleet/isAssignable';
import { cpkForBook } from '@/lib/fleet/book-cpk';
import { formatPerKm, formatSastDate } from '@/lib/fleet/format';
import { periodFor } from '@/lib/fleet/periods';
import { deskReminderRows, planReminders } from '@/lib/fleet/reminders';
import { parseThresholds, prdpUnchanged, reminderDraft, type ReminderDraft } from '@/lib/fleet/reminder-form';
import { templateCsv, validateComplianceCsv, validateDriverCsv, validateVehicleCsv, redactDryRun, type CsvImportResult } from '@/lib/fleet/import-csv';
import { planShipDrivers, planShipVehicles, PREVIEW_SHIP_DRIVER_ID, PREVIEW_SHIP_VEHICLE_ID, shipRowsForDesk, shipSourceHash } from '@/lib/fleet/import-ship';
import { writeCsv } from '@/lib/fleet/csv';
import { timelineFor } from '@/lib/fleet/renewal';
import type { ComplianceKind, FleetBook, FleetFeature, FleetReadiness } from '@/lib/fleet/types';
import type { FleetDeskProps } from './FleetViews';
import {
  FleetBanner,
  FleetDrawer,
  FleetEmpty,
  FleetError,
  FleetLoading,
  FleetPageHead,
  FleetSection,
  FleetSegmented,
  FleetStat,
  FleetStatusPill,
  FleetTable,
  fleetBtn,
  fleetField,
  fleetFocus,
  fleetGhost,
  fleetLabel,
} from './FleetUi';

const KINDS: ComplianceKind[] = [
  'licence_disc',
  'roadworthy',
  'operator_card',
  'insurance',
  'cross_border_permit',
  'abnormal_permit',
  'other_permit',
  'driver_licence',
  'prdp',
  'medical',
  'induction',
  'other',
];

const VEHICLE_EXPECTED: ComplianceKind[] = ['licence_disc', 'roadworthy', 'operator_card', 'insurance', 'cross_border_permit', 'abnormal_permit', 'other_permit'];
const DRIVER_EXPECTED: ComplianceKind[] = ['driver_licence', 'prdp', 'medical', 'induction', 'other'];

const READY: FleetReadiness = {
  compliance_b: { ready: true },
  reminders: { ready: true },
  imports: { ready: true },
  trailers: { ready: true },
};

function pending(props: FleetDeskProps, feature: FleetFeature): boolean {
  if (props.migrationPending) return true;
  const state = (props.readiness || READY)[feature];
  return !state.ready;
}

function shell(props: FleetDeskProps, testId: string, body: ReactNode) {
  if (props.phase === 'loading') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-4" data-testid={testId}>
        <FleetLoading />
      </main>
    );
  }
  if (props.phase === 'error') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-4" data-testid={testId}>
        <FleetError
          action={
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => props.onRetry?.()}>
              Try again
            </button>
          }
        />
      </main>
    );
  }
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid={testId}>
      {body}
    </main>
  );
}

function FeatureBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <FleetBanner tone="pending" testId="fleet-feature-pending">
      database setup pending for this feature
    </FleetBanner>
  );
}

export function ComplianceView(props: FleetDeskProps) {
  const [status, setStatus] = useState('all');
  const [mode, setMode] = useState('list');
  const [subject, setSubject] = useState('all');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [permits, setPermits] = useState(false);
  const [open, setOpen] = useState<CentreRow | null>(null);
  const [bulk, setBulk] = useState(false);
  const [permitOpen, setPermitOpen] = useState(false);
  const summaryRows = useMemo(
    () =>
      centreRows(props.book, props.today, {
        status: 'all',
        subject: subject as 'all',
        kind: kind === 'all' ? 'all' : (kind as ComplianceKind),
        search,
        permitsOnly: permits,
      }),
    [props.book, props.today, subject, kind, search, permits]
  );
  const rows = status === 'all' ? summaryRows : summaryRows.filter((row) => row.status === status);
  const summary = centreSummary(summaryRows);
  const agenda = monthAgenda(rows);
  const canEdit = props.caps.canEditRegister;
  const exportable = props.caps.canExportCompliance && summaryRows.some((row) => !row.synthetic);
  const preview = props.hrefBase.startsWith('/preview');

  async function download() {
    if (!exportable) return;
    const table = exportRows(summaryRows, props.book.workspace.real_data_enabled);
    const csv = writeCsv(table.headers, table.rows);
    if (preview) {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fleet-dates.csv';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const companyId = window.localStorage.getItem('selectedCompanyId') || '';
    const response = await fetch('/api/fleet/fleetgraph/compliance/export', { headers: { 'x-fleet-company': companyId } });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fleet-dates.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return shell(
    props,
    'fleet-compliance',
    <>
      <FleetPageHead
        title="Compliance"
        detail="FleetAdvisor® dates you entered: expired, expiring, and not recorded."
        illustration={props.illustrate}
        testId="fleet-compliance-head"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} data-testid="fleet-bulk" onClick={() => setBulk(true)} disabled={!canEdit}>
              Bulk entry
            </button>
            <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/import`} data-testid="fleet-import-link">
              Import
            </Link>
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} data-testid="fleet-export" disabled={!exportable} onClick={() => download()}>
              Export CSV
            </button>
          </div>
        }
      />
      <FeatureBanner show={pending(props, 'compliance_b')} />
      {!props.caps.canEditRegister ? <FleetBanner tone="info">You can look. An owner, manager or dispatcher records dates.</FleetBanner> : null}
      {!exportable ? (
        <p className="text-sm text-slate-600" data-testid="fleet-export-reason">
          {props.caps.canExportCompliance ? 'Export stays off until there is a date to include.' : 'Export is for an owner, manager or office role.'}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <button type="button" className="text-left" onClick={() => setStatus('expired')} data-testid="fleet-kpi-expired">
          <FleetStat value={summary.expired} label="Expired" tone="slate" />
        </button>
        <button type="button" className="text-left" onClick={() => setStatus('expiring')} data-testid="fleet-kpi-expiring">
          <FleetStat value={summary.expiring} label="Expiring in the window" tone="deep" />
        </button>
        <button type="button" className="text-left" onClick={() => setStatus('no_date')} data-testid="fleet-kpi-missing">
          <FleetStat value={summary.not_recorded} label="Not recorded" tone="white" />
        </button>
        <button type="button" className="text-left" onClick={() => setStatus('valid')} data-testid="fleet-kpi-valid">
          <FleetStat value={summary.valid} label="Valid" tone="cyan" />
        </button>
      </div>
      <FleetSegmented
        label="Status"
        value={status}
        onChange={setStatus}
        options={[
          { id: 'all', label: 'All' },
          { id: 'expired', label: 'Expired' },
          { id: 'expiring', label: 'Expiring' },
          { id: 'no_date', label: 'Not recorded' },
          { id: 'valid', label: 'Valid' },
        ]}
      />
      <FleetSegmented
        label="Layout"
        value={mode}
        onChange={setMode}
        options={[
          { id: 'list', label: 'List' },
          { id: 'calendar', label: 'Calendar' },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <FleetSegmented
          label="Subject"
          value={subject}
          onChange={setSubject}
          options={[
            { id: 'all', label: 'All' },
            { id: 'vehicle', label: 'Vehicles' },
            { id: 'driver', label: 'Drivers' },
          ]}
        />
        <button type="button" className={`${permits ? fleetBtn : fleetGhost} ${fleetFocus}`} data-testid="fleet-permits" onClick={() => setPermits((value) => !value)}>
          Permits
        </button>
        <button type="button" className={`${fleetGhost} ${fleetFocus}`} data-testid="fleet-permit-drawer" onClick={() => setPermitOpen(true)}>
          Record a permit
        </button>
      </div>
      <label className={fleetLabel}>
        Search
        <input className={`${fleetField} ${fleetFocus}`} value={search} onChange={(event) => setSearch(event.target.value)} data-testid="fleet-compliance-search" />
      </label>
      <label className={fleetLabel}>
        Kind
        <select className={`${fleetField} ${fleetFocus}`} value={kind} onChange={(event) => setKind(event.target.value)} data-testid="fleet-kind-filter">
          <option value="all">Every kind</option>
          {KINDS.map((item) => (
            <option key={item} value={item}>
              {complianceKindLabel(item)}
            </option>
          ))}
        </select>
      </label>
      {props.book.vehicles.length === 0 && props.book.drivers.length === 0 ? (
        <FleetEmpty
          title="No dates yet"
          hint={
            preview
              ? 'Illustration · sample data appears on the preview. Add a vehicle, then record its licence disc date.'
              : 'Add a vehicle, then record its licence disc date.'
          }
          testId="fleet-compliance-empty"
          action={
            <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`} data-testid="fleet-add-first-date">
              Add your first licence disc date
            </Link>
          }
        />
      ) : mode === 'calendar' ? (
        <div data-testid="fleet-calendar" className="space-y-3">
          {agenda.length === 0 ? <p className="text-sm text-slate-600">No dated rows in this filter.</p> : null}
          {agenda.map((month) => (
            <FleetSection key={month.month} title={monthTitle(month.month)}>
              {month.dates.map((day) => (
                <div key={day.date} className="border-t border-slate-200 py-2">
                  <p className="text-sm font-black">{formatSastDate(day.date)}</p>
                  <ul className="mt-1 space-y-1">
                    {day.rows.map((row) => (
                      <li key={row.id}>
                        <button type="button" className={`${fleetGhost} ${fleetFocus}`} onClick={() => setOpen(row)}>
                          {row.subjectLabel} · {row.kindLabel}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </FleetSection>
          ))}
        </div>
      ) : (
        <FleetTable
          testId="fleet-compliance-table"
          columns={['Subject', 'Kind', 'Reference', 'Expires', 'Status', 'Next reminder']}
          rows={rows.map((row) => ({
            id: row.id,
            cells: [
              <button key="s" type="button" className={`${fleetGhost} ${fleetFocus}`} data-testid={`fleet-row-${row.id}`} onClick={() => setOpen(row)}>
                {row.subjectLabel}
              </button>,
              row.kindLabel,
              row.reference || '—',
              row.expiresOn ? formatSastDate(row.expiresOn) : 'Not recorded',
              <FleetStatusPill key="s" tone={row.status === 'valid' ? 'ok' : row.status === 'expired' ? 'bad' : 'warn'}>
                {row.statusLabel}
              </FleetStatusPill>,
              nextReminder(props.book, row, props.today),
            ],
            card: (
              <button type="button" className="min-h-11 w-full text-left" data-testid={`fleet-card-${row.id}`} onClick={() => setOpen(row)}>
                <p className="font-black">{row.subjectLabel}</p>
                <p className="text-sm text-slate-600">{cardLine(row)}</p>
                <p className="text-sm text-slate-600">{nextReminder(props.book, row, props.today)}</p>
              </button>
            ),
          }))}
        />
      )}
      <ItemDrawer
        props={props}
        row={open}
        onClose={() => setOpen(null)}
        onRenewed={() => {
          setStatus('all');
          setOpen(null);
        }}
      />
      <BulkDrawer props={props} open={bulk} onClose={() => setBulk(false)} />
      <PermitDrawer props={props} open={permitOpen} onClose={() => setPermitOpen(false)} />
    </>
  );
}

function ItemDrawer({
  props,
  row,
  onClose,
  onRenewed,
}: {
  props: FleetDeskProps;
  row: CentreRow | null;
  onClose: () => void;
  onRenewed: () => void;
}) {
  const [expires, setExpires] = useState('2027-03-12');
  const [reference, setReference] = useState('');
  if (!row) return <FleetDrawer open={false} title="Date" onClose={onClose}>{null}</FleetDrawer>;
  const current = props.book.compliance.find((item) => item.id === row.itemId);
  return (
    <FleetDrawer open title={row.kindLabel} onClose={onClose} testId="fleet-item-drawer">
      <p className="text-sm text-slate-600">
        {row.subjectLabel} · {row.statusLabel}
      </p>
      {row.synthetic ? (
        <button
          type="button"
          className={`${fleetBtn} ${fleetFocus} mt-3`}
          data-testid="fleet-add-date"
          disabled={!props.caps.canEditRegister}
          onClick={() =>
            props.onOp?.({
              op: 'compliance.upsert',
              payload: {
                subject_kind: row.subjectKind,
                subject_id: row.subjectId,
                kind: row.kind,
                expires_on: expires,
                reference,
              },
            })
          }
        >
          Add date
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <label className={fleetLabel}>
            New expiry
            <input className={`${fleetField} ${fleetFocus}`} type="date" value={expires} onChange={(event) => setExpires(event.target.value)} data-testid="fleet-renew-date" />
          </label>
          <label className={fleetLabel}>
            Reference
            <input className={`${fleetField} ${fleetFocus}`} value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
          <button
            type="button"
            className={`${fleetBtn} ${fleetFocus}`}
            data-testid="fleet-renew"
            disabled={!props.caps.canEditRegister || !current}
            onClick={() => {
              const ok = props.onOp?.({
                op: 'compliance.renew',
                payload: { id: current?.id, expires_on: expires, reference },
              });
              if (ok) onRenewed();
            }}
          >
            Renew
          </button>
        </div>
      )}
    </FleetDrawer>
  );
}

function BulkDrawer({ props, open, onClose }: { props: FleetDeskProps; open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<ComplianceKind>('licence_disc');
  const [subject, setSubject] = useState<'vehicle' | 'driver'>('vehicle');
  const subjects = subject === 'vehicle' ? props.book.vehicles.filter((row) => !row.archived_at) : props.book.drivers.filter((row) => !row.archived_at);
  const [dates, setDates] = useState<Record<string, string>>({});
  const changed = Object.values(dates).filter(Boolean).length;
  const demoDrivers = subject === 'driver' && !props.book.workspace.real_data_enabled;
  return (
    <FleetDrawer open={open} title="Bulk entry" onClose={onClose} testId="fleet-bulk-drawer">
      <FleetSegmented
        label="Who"
        value={subject}
        onChange={(id) => setSubject(id as 'vehicle' | 'driver')}
        options={[
          { id: 'vehicle', label: 'Vehicles' },
          { id: 'driver', label: 'Drivers' },
        ]}
      />
      <label className={`${fleetLabel} mt-3`}>
        Kind
        <select className={`${fleetField} ${fleetFocus}`} value={kind} onChange={(event) => setKind(event.target.value as ComplianceKind)}>
          {KINDS.map((item) => (
            <option key={item} value={item}>
              {complianceKindLabel(item)}
            </option>
          ))}
        </select>
      </label>
      {demoDrivers ? (
        <FleetBanner tone="info">Demo-data mode is on. Personal details stay off until an owner confirms real data in Settings.</FleetBanner>
      ) : null}
      <ul className="mt-3 space-y-2">
        {subjects.map((item) => (
          <li key={item.id} className="rounded-2xl border border-slate-200 p-3">
            <p className="font-bold">{'reg_no' in item ? item.reg_no : item.full_name}</p>
            <label className={fleetLabel}>
              Expiry
              <input
                className={`${fleetField} ${fleetFocus}`}
                type="date"
                data-testid={`fleet-bulk-date-${item.id}`}
                value={dates[item.id] || ''}
                onChange={(event) => setDates((current) => ({ ...current, [item.id]: event.target.value }))}
              />
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm font-bold" data-testid="fleet-bulk-count">
        {changed} rows changed
      </p>
      <button
        type="button"
        className={`${fleetBtn} ${fleetFocus} mt-3`}
        data-testid="fleet-bulk-save"
        disabled={!changed || demoDrivers || !props.caps.canEditRegister}
        onClick={() => {
          const rows = subjects
            .filter((item) => dates[item.id])
            .map((item) => {
              const existing = props.book.compliance.find(
                (row) => !row.archived_at && row.subject_id === item.id && row.kind === kind && row.subject_kind === subject
              );
              return {
                id: existing?.id,
                expected_updated_at: existing?.updated_at,
                subject_kind: subject,
                subject_id: item.id,
                kind,
                expires_on: dates[item.id],
              };
            });
          props.onOp?.({ op: 'compliance.bulk_upsert', payload: { rows } });
          onClose();
        }}
      >
        Save dates
      </button>
    </FleetDrawer>
  );
}

function PermitDrawer({ props, open, onClose }: { props: FleetDeskProps; open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'cross_border_permit' | 'abnormal_permit'>('cross_border_permit');
  const [vehicleId, setVehicleId] = useState(props.book.vehicles[0]?.id || '');
  const [countries, setCountries] = useState('ZA, BW');
  const [province, setProvince] = useState('');
  const [route, setRoute] = useState('');
  const [conditions, setConditions] = useState('');
  const [escort, setEscort] = useState(false);
  const [expires, setExpires] = useState('2027-03-12');
  const detail =
    kind === 'cross_border_permit'
      ? { countries: countries.split(/[,\s]+/).filter(Boolean) }
      : { province, route_text: route, conditions, escort_required: escort };
  return (
    <FleetDrawer open={open} title="Permit" onClose={onClose} testId="fleet-permit-drawer">
      <FleetSegmented
        label="Permit"
        value={kind}
        onChange={(id) => setKind(id as 'cross_border_permit' | 'abnormal_permit')}
        options={[
          { id: 'cross_border_permit', label: 'Cross-border' },
          { id: 'abnormal_permit', label: 'Abnormal load' },
        ]}
      />
      <label className={`${fleetLabel} mt-3`}>
        Vehicle
        <select className={`${fleetField} ${fleetFocus}`} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} data-testid="fleet-permit-vehicle">
          {props.book.vehicles.filter((row) => !row.archived_at).map((row) => (
            <option key={row.id} value={row.id}>
              {row.reg_no}
            </option>
          ))}
        </select>
      </label>
      {kind === 'cross_border_permit' ? (
        <label className={fleetLabel}>
          Country codes
          <input className={`${fleetField} ${fleetFocus}`} value={countries} onChange={(event) => setCountries(event.target.value)} data-testid="fleet-permit-countries" />
        </label>
      ) : (
        <>
          <label className={fleetLabel}>
            Province
            <input className={`${fleetField} ${fleetFocus}`} value={province} onChange={(event) => setProvince(event.target.value)} data-testid="fleet-permit-province" />
          </label>
          <label className={fleetLabel}>
            Route text
            <input className={`${fleetField} ${fleetFocus}`} value={route} onChange={(event) => setRoute(event.target.value)} data-testid="fleet-permit-route" />
          </label>
          <label className={fleetLabel}>
            Conditions
            <input className={`${fleetField} ${fleetFocus}`} value={conditions} onChange={(event) => setConditions(event.target.value)} />
          </label>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={escort} onChange={(event) => setEscort(event.target.checked)} data-testid="fleet-permit-escort" />
            Escort required
          </label>
        </>
      )}
      <label className={fleetLabel}>
        Expiry
        <input className={`${fleetField} ${fleetFocus}`} type="date" value={expires} onChange={(event) => setExpires(event.target.value)} data-testid="fleet-permit-expiry" />
      </label>
      <button
        type="button"
        className={`${fleetBtn} ${fleetFocus} mt-3`}
        data-testid="fleet-save-permit"
        disabled={!props.caps.canEditRegister}
        onClick={() =>
          props.onOp?.({
            op: 'compliance.upsert',
            payload: { subject_kind: 'vehicle', subject_id: vehicleId, kind, expires_on: expires, detail },
          })
        }
      >
        Save permit
      </button>
    </FleetDrawer>
  );
}

export function ImportView(props: FleetDeskProps) {
  const [mode, setMode] = useState('vehicles_csv');
  const [text, setText] = useState(templateCsv('vehicles_csv'));
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [fresh, setFresh] = useState(false);
  const [awaitShip, setAwaitShip] = useState(false);
  const previewDesk = props.hrefBase.startsWith('/preview');
  const demo = !props.book.workspace.real_data_enabled;
  const driverKind = mode === 'drivers_csv' || mode === 'ship_drivers';
  const ship = mode === 'ship_vehicles' || mode === 'ship_drivers';
  const canShip = props.caps.canImportShip;
  const canCsv = props.caps.canImportCsv;

  useEffect(() => {
    if (previewDesk || !awaitShip || !ship) return;
    const run = props.book.import_runs.find((row) => row.dry_run && row.kind === mode);
    if (!run) return;
    setResult({
      rows: shipRowsForDesk(false, []),
      errors: [],
      warnings: [],
      summary: {
        create: run.row_counts.create,
        link: run.row_counts.link,
        fill: run.row_counts.fill,
        errors: run.row_counts.errors,
      },
      source_hash: run.source_hash,
    });
    setFresh(true);
  }, [awaitShip, previewDesk, ship, mode, props.book.import_runs]);

  async function runDry() {
    if (ship) {
      if (!previewDesk) {
        setResult(null);
        setFresh(false);
        const outcome = await props.onOp?.({ op: 'import.dry_run', payload: { kind: mode, source_label: 'Ship' } });
        if (outcome === false) return;
        setAwaitShip(true);
        return;
      }
      const vehicleRow = { id: 'ship-9', plate_number: 'SAMPLE 99', make_model: 'Sample Rigid', vehicle_type: 'truck', capacity_kg: 8000, status: 'available' };
      const driverRow = { id: 'ship-d', full_name: 'Sample Driver C', phone: '', email: 'sample.driver.c@example.com', license_class: 'EC', status: 'available' };
      const planned =
        mode === 'ship_vehicles'
          ? planShipVehicles([vehicleRow], props.book, props.today, () => PREVIEW_SHIP_VEHICLE_ID)
          : planShipDrivers([driverRow], props.book, props.today, () => PREVIEW_SHIP_DRIVER_ID);
      const hash = shipSourceHash(mode === 'ship_drivers' ? 'ship_drivers' : 'ship_vehicles', mode === 'ship_drivers' ? [driverRow] : [vehicleRow]);
      const shown = planned.summary;
      const rows = shipRowsForDesk(true, demo && mode === 'ship_drivers' ? [] : planned.rows);
      setResult({
        rows,
        errors: [],
        warnings: planned.warnings,
        summary: shown,
        source_hash: hash,
      });
      setFresh(true);
      props.onOp?.({ op: 'import.dry_run', payload: { kind: mode, source_hash: hash, source_label: 'Ship', summary: shown } });
      return;
    }
    const parsed =
      mode === 'drivers_csv'
        ? validateDriverCsv(text, props.book, props.today)
        : mode === 'compliance_csv'
          ? validateComplianceCsv(text, props.book, props.today)
          : validateVehicleCsv(text, props.book, props.today);
    const safe = redactDryRun(parsed, demo && (mode === 'drivers_csv' || mode === 'compliance_csv'));
    setResult(safe);
    setFresh(true);
    props.onOp?.({
      op: 'import.dry_run',
      payload: { kind: mode, source_hash: parsed.source_hash, source_label: 'Pasted CSV', summary: safe.summary, csv: text },
    });
  }

  async function commit() {
    if (!result || (!fresh && !already)) return;
    const outcome = await props.onOp?.({
      op: 'import.commit',
      payload: {
        kind: mode,
        source_hash: result.source_hash,
        source_label: mode.startsWith('ship') ? 'Ship' : 'Pasted CSV',
        plans: ship && !previewDesk ? [] : result.rows,
        ...(ship ? {} : { csv: text }),
      },
    });
    if (outcome === false) return;
    setFresh(false);
  }

  const already = props.book.import_runs.some((run) => result && !run.dry_run && run.status === 'committed' && run.source_hash === result.source_hash);

  return shell(
    props,
    'fleet-import',
    <>
      <FleetPageHead title="Import" detail="FleetAdvisor® brings a register in from Ship or a CSV. Ship is never changed." illustration={props.illustrate} />
      <FeatureBanner show={pending(props, 'imports')} />
      <FleetSegmented
        label="Source"
        value={mode}
        onChange={(id) => {
          setMode(id);
          setResult(null);
          setFresh(false);
          setAwaitShip(false);
          if (id === 'vehicles_csv' || id === 'drivers_csv' || id === 'compliance_csv') setText(templateCsv(id));
        }}
        options={[
          { id: 'ship_vehicles', label: 'Ship vehicles' },
          { id: 'ship_drivers', label: 'Ship drivers' },
          { id: 'vehicles_csv', label: 'Vehicles CSV' },
          { id: 'drivers_csv', label: 'Drivers CSV' },
          { id: 'compliance_csv', label: 'Compliance CSV' },
        ]}
      />
      {ship ? (
        <FleetSection title="Import from Ship">
          <p className="text-sm text-slate-600">One-way and idempotent. Ship is never changed. Licence numbers are never read.</p>
          {!canShip ? <p className="mt-2 text-sm font-bold">Only an owner can import from Ship.</p> : null}
        </FleetSection>
      ) : (
        <label className={fleetLabel}>
          CSV
          <textarea className={`${fleetField} ${fleetFocus} min-h-32`} value={text} onChange={(event) => setText(event.target.value)} data-testid="fleet-csv" />
        </label>
      )}
      {driverKind && demo ? (
        <FleetBanner tone="info">Demo-data mode is on. Personal details stay off until an owner confirms real data in Settings. Dry-run counts still work.</FleetBanner>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${fleetBtn} ${fleetFocus}`} data-testid="fleet-dry-run" disabled={ship ? !canShip : !canCsv} onClick={runDry}>
          Dry run
        </button>
        <button
          type="button"
          className={`${fleetBtn} ${fleetFocus}`}
          data-testid="fleet-commit"
          disabled={(!fresh && !already) || !result || (driverKind && demo) || (ship ? !canShip : !canCsv)}
          onClick={commit}
        >
          Commit
        </button>
      </div>
      {already ? <p data-testid="fleet-already">Already imported.</p> : null}
      {result ? (
        <div data-testid="fleet-dry-result">
          <p className="text-sm font-bold">
            Create {result.summary.create} · Link {result.summary.link} · Fill {result.summary.fill} · Errors {result.summary.errors}
          </p>
          {ship && !previewDesk ? null : (
          <div className="mt-3 overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm" data-testid="fleet-import-table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Row</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Result</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, index) => (
                  <tr key={`plan-${index}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 tabular-nums">{index + 2}</td>
                    <td className="px-3 py-2">{row.action === 'create' ? 'Create' : 'Link'}</td>
                    <td className="px-3 py-2">{planLabel(row)}</td>
                  </tr>
                ))}
                {result.errors.map((error) => (
                  <tr key={`${error.row}-${error.field}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 tabular-nums">{error.row}</td>
                    <td className="px-3 py-2">Error</td>
                    <td className="px-3 py-2">{error.message || `${error.field} · ${error.code}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ) : null}
      <FleetSection title="Run history">
        {props.book.import_runs.length === 0 ? <p className="text-sm text-slate-600">No runs yet.</p> : null}
        <ul className="space-y-2" data-testid="fleet-import-history">
          {props.book.import_runs.map((run) => (
            <li key={run.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
              {run.kind} · {run.source_label || 'Untitled'} · {run.status} · {formatSastDate(run.created_at)}
            </li>
          ))}
        </ul>
      </FleetSection>
    </>
  );
}

export function VehicleDetailView(props: FleetDeskProps) {
  const vehicle = props.book.vehicles.find((row) => row.id === props.subjectId);
  if (!vehicle) {
    return shell(
      props,
      'fleet-vehicle-detail',
      <FleetEmpty
        title="That vehicle is not on this desk"
        hint="The registration is unknown on this company desk."
        action={
          <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>
            Back to vehicles
          </Link>
        }
      />
    );
  }
  const verdict = isAssignable({ kind: 'vehicle', row: vehicle }, props.today, {
    items: props.book.compliance,
    workspace: props.book.workspace,
  });
  const chain = timelineFor({ kind: 'vehicle', id: vehicle.id }, props.book.compliance);
  const links = props.book.trailer_links.filter((link) => link.truck_id === vehicle.id || link.trailer_id === vehicle.id);
  const period = periodFor(props.periodId, props.today, props.book.workspace.cpk_window_days);
  const metric = props.caps.seesCosts ? cpkForBook(props.book, period).find((row) => row.vehicle_id === vehicle.id) : undefined;
  const next = nextReminder(props.book, vehicle.id, props.today);
  const trailers = props.book.vehicles.filter((row) => row.kind === 'trailer' && !row.archived_at);
  return shell(
    props,
    'fleet-vehicle-detail',
    <>
      <p className="text-sm font-bold text-[#0077b6]">FleetAdvisor®</p>
      <FleetPageHead title={vehicle.reg_no} detail="Registration, dates, trailers and cost." illustration={props.illustrate} />
      <FeatureBanner show={pending(props, 'trailers') || pending(props, 'compliance_b')} />
      <Link className={`${fleetGhost} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>
        Vehicles
      </Link>
      <FleetStatusPill tone={verdict.assignable ? 'ok' : 'bad'}>
        <span data-testid="fleet-assign">{verdict.assignable ? 'Can be assigned today' : 'Cannot be assigned today'}</span>
      </FleetStatusPill>
      <ul className="space-y-1 text-sm" data-testid="fleet-assign-reasons">
        {verdict.reasons.map((reason) => (
          <li key={`${reason.code}-${reason.kind || ''}`}>{reason.message}</li>
        ))}
      </ul>
      <FleetSection title="Compliance timeline">
        <ul data-testid="fleet-timeline" className="relative space-y-3 border-l-2 border-[#00b4d8] pl-4">
          {chain.map(({ item, current }) => (
            <li key={item.id} className="relative rounded-2xl border border-slate-200 p-3 text-sm">
              <span className="absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full border-2 border-white bg-[#00b4d8]" />
              {complianceKindLabel(item.kind)} · {item.expires_on ? formatSastDate(item.expires_on) : 'Not recorded'}
              {current ? ' · current' : ' · earlier'}
              {Array.isArray(item.detail.countries) ? ` · ${(item.detail.countries as string[]).join(', ')}` : ''}
              {typeof item.detail.route_text === 'string' ? ` · ${item.detail.route_text}` : ''}
            </li>
          ))}
        </ul>
      </FleetSection>
      <p className="text-sm" data-testid="fleet-reminder-preview">
        {next}
      </p>
      <FleetSection title="Trailers">
        <ul className="space-y-2 text-sm">
          {links.map((link) => {
            const other = props.book.vehicles.find((row) => row.id === (link.truck_id === vehicle.id ? link.trailer_id : link.truck_id));
            return (
              <li key={link.id}>
                {other?.reg_no || 'Trailer'} · {formatSastDate(link.from_on)}
                {link.to_on ? ` to ${formatSastDate(link.to_on)}` : ' · current'}
              </li>
            );
          })}
        </ul>
        {props.caps.canManageTrailers && vehicle.kind !== 'trailer' ? (
          <HitchForm props={props} truckId={vehicle.id} trailers={trailers} />
        ) : null}
        {props.notice ? (
          <p className="mt-2 text-sm font-bold" data-testid="fleet-hitch-error">
            {props.notice}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600">A trailer hitches to one truck on a date. A second hitch on the same dates is refused.</p>
      </FleetSection>
      {props.caps.seesCosts ? (
        <FleetSection title="Cost per kilometre">
          <p data-testid="fleet-detail-cpk">{metric?.status === 'ok' ? `${formatPerKm(metric.fully_loaded_per_km)} per km` : 'Not enough data'}</p>
        </FleetSection>
      ) : (
        <p className="text-sm text-slate-600">Cost per kilometre is hidden for this role.</p>
      )}
    </>
  );
}

export function DriverDetailView(props: FleetDeskProps) {
  const driver = props.book.drivers.find((row) => row.id === props.subjectId);
  if (!driver) {
    return shell(
      props,
      'fleet-driver-detail',
      <FleetEmpty
        title="That driver is not on this desk"
        hint="The name is unknown on this company desk."
        action={
          <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/drivers`}>
            Back to drivers
          </Link>
        }
      />
    );
  }
  const vehicle = props.book.vehicles.find((row) => row.id === 'sample-01') || props.book.vehicles[0];
  const verdict = isAssignable({ kind: 'driver', row: driver }, props.today, {
    items: props.book.compliance,
    workspace: props.book.workspace,
    pairedVehicle: vehicle ? { id: vehicle.id, gvm_kg: vehicle.gvm_kg, kind: vehicle.kind, reg_no: vehicle.reg_no } : null,
  });
  const chain = timelineFor({ kind: 'driver', id: driver.id }, props.book.compliance);
  return shell(
    props,
    'fleet-driver-detail',
    <>
      <p className="text-sm font-bold text-[#0077b6]">FleetAdvisor®</p>
      <FleetPageHead title={driver.full_name} detail="Licence code, dates and whether they can be assigned." illustration={props.illustrate} />
      <FeatureBanner show={pending(props, 'compliance_b')} />
      <Link className={`${fleetGhost} ${fleetFocus}`} href={`${props.hrefBase}/drivers`}>
        Drivers
      </Link>
      <FleetStatusPill tone={verdict.assignable ? 'ok' : 'bad'}>
        <span data-testid="fleet-assign">{verdict.assignable ? 'Can be assigned today' : 'Cannot be assigned today'}</span>
      </FleetStatusPill>
      <ul data-testid="fleet-assign-reasons">
        {verdict.reasons.map((reason) => (
          <li key={`${reason.code}-${reason.message}`}>{reason.message}</li>
        ))}
      </ul>
      <FleetSection title="Compliance timeline">
        <ul data-testid="fleet-timeline" className="relative space-y-3 border-l-2 border-[#00b4d8] pl-4">
          {chain.map(({ item, current }) => (
            <li key={item.id} className="relative text-sm">
              <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#00b4d8]" />
              {complianceKindLabel(item.kind)} · {item.expires_on ? formatSastDate(item.expires_on) : 'Not recorded'}
              {current ? ' · current' : ' · earlier'}
            </li>
          ))}
        </ul>
      </FleetSection>
      <p data-testid="fleet-reminder-preview">{nextReminder(props.book, driver.id, props.today)}</p>
    </>
  );
}

export function RemindersPanel(props: FleetDeskProps) {
  const rules = props.book.reminders.filter((row) => !row.archived_at);
  const [pick, setPick] = useState(rules[0]?.id || '');
  const selected = rules.find((row) => row.id === pick) || null;
  const [form, setForm] = useState<ReminderDraft>(() => reminderDraft(rules[0] || null));
  const [thresholds, setThresholds] = useState(() => (rules[0]?.thresholds_days || [30, 14, 7, 0]).join(', '));
  const [logPage, setLogPage] = useState(1);
  const [pendingNew, setPendingNew] = useState<{ ids: string[]; scope: ReminderDraft['scope_kind']; kind: string | null } | null>(null);
  useEffect(() => {
    if (!pendingNew) return;
    const created = props.book.reminders.find(
      (row) =>
        !row.archived_at &&
        !pendingNew.ids.includes(row.id) &&
        row.scope_kind === pendingNew.scope &&
        (row.kind || null) === (pendingNew.kind || null)
    );
    if (!created) return;
    const draft = reminderDraft(created);
    setPick(created.id);
    setForm(draft);
    setThresholds(draft.thresholds_days.join(', '));
    setPendingNew(null);
  }, [pendingNew, props.book.reminders]);
  if (!props.caps.canManageReminders) {
    return <p className="text-sm text-slate-600">Reminder settings are for an owner or manager.</p>;
  }
  const preview = planReminders({
    items: props.book.compliance,
    rules: props.book.reminders,
    vehicles: props.book.vehicles,
    drivers: props.book.drivers,
    members: props.book.members,
    logKeys: props.book.reminder_log.map((row) => `${row.item_id}|${row.expires_on}|${row.threshold_days}|${row.channel}|${row.recipient_key}`),
    now: `${props.today}T12:00:00.000Z`,
    workspace: props.book.workspace,
  });
  const log = deskReminderRows(props.book.reminder_log);
  const shownLog = log.slice(0, logPage * 50);
  function choose(ruleId: string) {
    const rule = rules.find((row) => row.id === ruleId) || null;
    const draft = reminderDraft(rule);
    setPendingNew(null);
    setPick(rule?.id || '');
    setForm(draft);
    setThresholds(draft.thresholds_days.join(', '));
  }
  async function saveReminder() {
    const days = parseThresholds(thresholds);
    const creating = !form.id;
    const ids = rules.map((rule) => rule.id);
    const outcome = await props.onOp?.(
      {
        op: 'reminder.upsert',
        payload: {
          ...(form.id ? { id: form.id } : {}),
          scope_kind: form.scope_kind,
          kind: form.kind,
          thresholds_days: days,
          channels: form.channels,
          recipient_member_ids: form.recipient_member_ids,
          enabled: form.enabled,
        },
      },
      form.id ? selected?.updated_at : undefined
    );
    if (outcome === false) return;
    if (creating) setPendingNew({ ids, scope: form.scope_kind, kind: form.kind });
  }
  function toggleChannel(channel: 'email' | 'push') {
    setForm((current) => ({
      ...current,
      channels: current.channels.includes(channel) ? current.channels.filter((item) => item !== channel) : [...current.channels, channel],
    }));
  }
  function toggleRecipient(id: string) {
    setForm((current) => ({
      ...current,
      recipient_member_ids: current.recipient_member_ids.includes(id)
        ? current.recipient_member_ids.filter((item) => item !== id)
        : [...current.recipient_member_ids, id],
    }));
  }
  function toggleExpected(key: 'expected_vehicle_kinds' | 'expected_driver_kinds', kind: ComplianceKind) {
    const current = props.book.workspace[key];
    const next = current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind];
    props.onOp?.({ op: 'settings.update', payload: { [key]: next } }, props.book.workspace.updated_at);
  }
  return (
    <FleetSection title="Reminders">
      <FeatureBanner show={pending(props, 'reminders')} />
      <p className="text-sm text-slate-600" data-testid="fleet-reminders">
        Reminders send nothing while demo-data mode is on. Thresholds are a starting point you can edit, from 0 to 365. Check the PrDP figure with your licensing authority.
      </p>
      <p className="mt-2 text-sm">Email is {props.book.workspace.comms_flags.email ? 'on' : 'off'}. A rule cannot send email while the flag is off.</p>
      <p className="text-sm" data-testid="fleet-web-push">
        {props.webPush === 'ready' ? 'Web push is ready on this desk.' : 'Web push is not configured on this desk.'}
      </p>
      <p className="text-sm" data-testid="fleet-would-send">
        What would be sent on {formatSastDate(props.today)}: {preview.due.length} reminder{preview.due.length === 1 ? '' : 's'}. Nothing is sent from this screen.
      </p>
      {preview.due.length === 0 ? (
        <p className="text-sm" data-testid="fleet-reminder-zero">
          No reminder matches this date. Adjust the thresholds, the scope, or the dates on the register.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2" data-testid="fleet-reminder-rules">
        {rules.map((rule) => (
          <button key={rule.id} type="button" className={`${pick === rule.id ? fleetBtn : fleetGhost} ${fleetFocus}`} data-testid={`fleet-rule-${rule.id}`} onClick={() => choose(rule.id)}>
            {rule.scope_kind} · {rule.kind ? complianceKindLabel(rule.kind) : 'Any date'} · {rule.enabled ? 'On' : 'Off'}
          </button>
        ))}
        <button type="button" className={`${fleetGhost} ${fleetFocus}`} data-testid="fleet-reminder-new" onClick={() => choose('')}>
          New rule
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600">A new rule stays off, with no recipients, until you turn it on and choose who should receive it.</p>
      <label className={fleetLabel}>
        Scope
        <select
          className={`${fleetField} ${fleetFocus}`}
          data-testid="fleet-reminder-scope"
          value={form.scope_kind}
          onChange={(event) => setForm((current) => ({ ...current, scope_kind: event.target.value as ReminderDraft['scope_kind'] }))}
        >
          <option value="all">All dates</option>
          <option value="vehicle">Vehicles</option>
          <option value="driver">Drivers</option>
        </select>
      </label>
      <label className={fleetLabel}>
        Date kind
        <select
          className={`${fleetField} ${fleetFocus}`}
          data-testid="fleet-reminder-kind"
          value={form.kind || ''}
          onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value || null }))}
        >
          <option value="">Any date</option>
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {complianceKindLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <label className={fleetLabel}>
        Thresholds
        <input className={`${fleetField} ${fleetFocus}`} value={thresholds} onChange={(event) => setThresholds(event.target.value)} data-testid="fleet-thresholds" />
      </label>
      <fieldset className="space-y-2" data-testid="fleet-reminder-channels">
        <legend className="text-sm font-bold">Channels</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={form.channels.includes('email')} disabled={!props.book.workspace.comms_flags.email} onChange={() => toggleChannel('email')} />
          Email
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={form.channels.includes('push')} onChange={() => toggleChannel('push')} />
          Web push
        </label>
      </fieldset>
      <fieldset className="space-y-2" data-testid="fleet-reminder-recipients">
        <legend className="text-sm font-bold">Recipients</legend>
        {props.book.members.length === 0 ? <p className="text-sm text-slate-600">No team members are on this desk yet.</p> : null}
        {props.book.members.map((member) => (
          <label key={member.id} className="flex min-h-11 items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              data-testid={`fleet-recipient-${member.id}`}
              checked={form.recipient_member_ids.includes(member.id)}
              onChange={() => toggleRecipient(member.id)}
            />
            {member.label}
          </label>
        ))}
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={form.enabled} data-testid="fleet-reminder-enabled" onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
        Enabled
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${fleetBtn} ${fleetFocus}`}
          data-testid="fleet-save-reminder"
          onClick={() => {
            void saveReminder();
          }}
        >
          Save reminder
        </button>
        {form.id ? (
          <button
            type="button"
            className={`${fleetGhost} ${fleetFocus}`}
            data-testid="fleet-archive-reminder"
            onClick={() => props.onOp?.({ op: 'reminder.archive', payload: { id: form.id } }, selected?.updated_at)}
          >
            Archive rule
          </button>
        ) : null}
      </div>
      <fieldset className="mt-4 space-y-2" data-testid="fleet-expected-vehicle">
        <legend className="text-sm font-bold">Expected vehicle dates</legend>
        {VEHICLE_EXPECTED.map((kind) => (
          <label key={kind} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={props.book.workspace.expected_vehicle_kinds.includes(kind)} onChange={() => toggleExpected('expected_vehicle_kinds', kind)} />
            {complianceKindLabel(kind)}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2" data-testid="fleet-expected-driver">
        <legend className="text-sm font-bold">Expected driver dates</legend>
        {DRIVER_EXPECTED.map((kind) => (
          <label key={kind} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={props.book.workspace.expected_driver_kinds.includes(kind)} onChange={() => toggleExpected('expected_driver_kinds', kind)} />
            {complianceKindLabel(kind)}
          </label>
        ))}
      </fieldset>
      <label className={fleetLabel}>
        Your threshold, check with your licensing authority (kg)
        <input
          className={`${fleetField} ${fleetFocus}`}
          inputMode="numeric"
          defaultValue={props.book.workspace.prdp_gvm_threshold_kg ?? ''}
          data-testid="fleet-prdp-threshold"
          onBlur={(event) => {
            if (prdpUnchanged(props.book.workspace.prdp_gvm_threshold_kg, event.target.value)) return;
            props.onOp?.(
              {
                op: 'settings.update',
                payload: { prdp_gvm_threshold_kg: event.target.value.trim() === '' ? null : Number(event.target.value) },
              },
              props.book.workspace.updated_at
            );
          }}
        />
      </label>
      <h3 className="mt-4 text-sm font-black">Reminder log</h3>
      <ul data-testid="fleet-reminder-log" className="space-y-1 text-sm">
        {shownLog.length === 0 ? <li>No reminder log rows yet.</li> : null}
        {shownLog.map((row) => (
          <li key={row.id}>
            {formatSastDate(row.at)} · {row.threshold_days} days · {row.channel} · {row.label}
          </li>
        ))}
      </ul>
      {shownLog.length < log.length ? (
        <button type="button" className={`${fleetGhost} ${fleetFocus} mt-2`} data-testid="fleet-reminder-more" onClick={() => setLogPage((page) => page + 1)}>
          Show more
        </button>
      ) : null}
    </FleetSection>
  );
}

function HitchForm({ props, truckId, trailers }: { props: FleetDeskProps; truckId: string; trailers: FleetBook['vehicles'] }) {
  const [trailerId, setTrailerId] = useState(trailers[0]?.id || '');
  return (
    <div className="mt-3 space-y-2">
      <label className={fleetLabel}>
        Trailer
        <select className={`${fleetField} ${fleetFocus}`} value={trailerId} onChange={(event) => setTrailerId(event.target.value)} data-testid="fleet-hitch-trailer">
          {trailers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.reg_no}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={`${fleetBtn} ${fleetFocus}`}
        data-testid="fleet-hitch"
        onClick={() => props.onOp?.({ op: 'trailer.link', payload: { truck_id: truckId, trailer_id: trailerId, from_on: props.today } })}
      >
        Hitch a trailer
      </button>
    </div>
  );
}

function planLabel(row: CsvImportResult['rows'][number]): string {
  if ('vehicle' in row) return row.vehicle.reg_no;
  if ('driver' in row) return row.driver.full_name || row.driver.email || 'Driver';
  return `${row.item.subject_kind} · ${complianceKindLabel(row.item.kind)}`;
}

function cardLine(row: CentreRow): string {
  if (!row.expiresOn && row.status === 'no_date') return `${row.kindLabel} · ${row.statusLabel}`;
  const when = row.expiresOn ? formatSastDate(row.expiresOn) : 'Not recorded';
  return `${row.kindLabel} · ${when} · ${row.statusLabel}`;
}

function nextReminder(book: FleetBook, target: string | CentreRow, today: string): string {
  const subjectId = typeof target === 'string' ? target : target.subjectId;
  const itemId = typeof target === 'string' ? null : target.itemId;
  if (typeof target !== 'string' && !itemId) return 'No reminder rule covers this';
  const plan = planReminders({
    items: book.compliance.filter((row) => {
      if (row.archived_at || row.subject_id !== subjectId) return false;
      return itemId ? row.id === itemId : true;
    }),
    rules: book.reminders,
    vehicles: book.vehicles,
    drivers: book.drivers,
    members: book.members,
    logKeys: [],
    now: `${today}T12:00:00.000Z`,
    workspace: book.workspace,
  });
  const first = plan.due[0];
  if (!first) return 'No reminder rule covers this';
  if (first.daysLeft < 0) {
    const days = Math.abs(first.daysLeft);
    return days === 1 ? 'Next reminder: expired 1 day ago' : `Next reminder: expired ${days} days ago`;
  }
  return `Next reminder: ${first.thresholdDays} days before ${formatSastDate(first.expiresOn)}`;
}
