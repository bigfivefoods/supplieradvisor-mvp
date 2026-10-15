'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Truck } from 'lucide-react';
import { cpkForBook } from '@/lib/fleet/book-cpk';
import { complianceLabel, complianceStatus } from '@/lib/fleet/compliance';
import { computeFleetCpk, type VehicleCpk } from '@/lib/fleet/cpk';
import { formatKm, formatLitresPer100, formatPerKm } from '@/lib/fleet/format';
import { nextMonth, periodFor, type PeriodId } from '@/lib/fleet/periods';
import { sampleCpkInput } from '@/lib/fleet/sample-book';
import type { FleetCapabilities } from '@/lib/fleet/roles';
import type { FleetBook, FleetOp, FleetRole } from '@/lib/fleet/types';
import { CpkWaterfallArt, DispatchArt, ExpiryStripArt, FleetRegisterArt, MapSketchArt, PodArt } from './Illustrations';
import {
  FleetBanner,
  FleetCompletenessChip,
  FleetDate,
  FleetDrawer,
  FleetEmpty,
  FleetError,
  FleetLoading,
  FleetMoney,
  FleetPageHead,
  FleetSection,
  FleetSegmented,
  FleetSoonChip,
  FleetStat,
  FleetStatusPill,
  FleetTable,
  FleetVariancePill,
  fleetBtn,
  fleetField,
  fleetFocus,
  fleetGhost,
  fleetLabel,
  fleetLink,
} from './FleetUi';

export type FleetScreen = 'command' | 'map' | 'vehicles' | 'drivers' | 'jobs' | 'cpk' | 'settings';

export type FleetDeskProps = {
  screen: FleetScreen;
  phase: 'loading' | 'error' | 'ready';
  book: FleetBook;
  role: FleetRole;
  caps: FleetCapabilities;
  periodId: PeriodId;
  hrefBase: string;
  today: string;
  notice?: string | null;
  migrationPending?: boolean;
  illustrate?: boolean;
  onPeriod?: (id: PeriodId) => void;
  onOp?: (op: FleetOp, expected?: string | null) => void;
};

function useCpk(props: FleetDeskProps): VehicleCpk[] {
  const period = periodFor(props.periodId, props.today, props.book.workspace.cpk_window_days);
  if (!props.caps.seesCosts) return [];
  const input = props.illustrate ? sampleCpkInput(props.book, period) : null;
  return input ? computeFleetCpk(input) : cpkForBook(props.book, period);
}

export function FleetDesk(props: FleetDeskProps) {
  if (props.phase === 'loading') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-4">
        <FleetLoading />
      </main>
    );
  }
  if (props.phase === 'error') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-4">
        <FleetError
          action={
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => props.onOp?.({ op: 'settings.update', payload: {} })}>
              Try again
            </button>
          }
        />
      </main>
    );
  }
  if (props.screen === 'command') return <CommandView {...props} />;
  if (props.screen === 'map') return <MapView {...props} />;
  if (props.screen === 'vehicles') return <VehiclesView {...props} />;
  if (props.screen === 'drivers') return <DriversView {...props} />;
  if (props.screen === 'jobs') return <JobsView {...props} />;
  if (props.screen === 'cpk') return <CpkView {...props} />;
  return <SettingsView {...props} />;
}

function Banners(props: FleetDeskProps) {
  return (
    <>
      {props.migrationPending ? (
        <FleetBanner tone="info" testId="fleet-migration-banner">
          Database setup is still pending. Figures will appear after the fleet tables are applied.
        </FleetBanner>
      ) : null}
      {!props.book.workspace.real_data_enabled ? (
        <FleetBanner tone="info" testId="fleet-demo-banner">
          Demo-data mode is on. Personal details stay off until an owner confirms real data in Settings.
        </FleetBanner>
      ) : null}
      {props.notice ? <FleetBanner tone="pending">{props.notice}</FleetBanner> : null}
    </>
  );
}

function CommandView(props: FleetDeskProps) {
  const cpk = useCpk({ ...props, periodId: 'last' });
  const vehicles = props.book.vehicles.filter((row) => !row.archived_at);
  const drivers = props.book.drivers.filter((row) => !row.archived_at);
  const openJobs = props.book.jobs.filter((row) => row.status !== 'cancelled' && !row.archived_at);
  const expiring = props.book.compliance.filter((row) => {
    const state = complianceStatus(row.expires_on, props.today, props.book.workspace.expiring_window_days);
    return state === 'expired' || state === 'expiring';
  });
  const fleet = fleetRollup(cpk);
  const empty = vehicles.length === 0 && drivers.length === 0 && openJobs.length === 0;
  const attention = attentionRows(props);
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-command">
      <FleetPageHead
        title="Command"
        detail="Vehicles, drivers, open jobs, expiries and fleet cost per kilometre."
        illustration={props.illustrate}
      />
      <Banners {...props} />
      {empty ? (
        <FleetEmpty
          testId="fleet-command-empty"
          icon={<Truck />}
          title="Your fleet desk is empty"
          hint="Add a vehicle to start the register. Cost per kilometre stays on Not enough data until odometer readings and costs exist."
          illustration={
            <div className="space-y-3">
              <FleetRegisterArt />
              <ExpiryStripArt />
              <CpkWaterfallArt />
            </div>
          }
          action={
            <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>
              Add your first vehicle
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <FleetStat label="Vehicles" value={String(vehicles.length)} />
            <FleetStat label="Drivers" value={String(drivers.length)} />
            <FleetStat label="Open jobs" value={String(openJobs.length)} />
            <FleetStat label="Expiring or expired" value={String(expiring.length)} />
            {props.caps.seesCosts ? (
              <div data-testid="fleet-cpk-tile">
                <FleetStat
                  label="Fleet CPK"
                  value={fleet.value}
                  hint={fleet.hint}
                />
              </div>
            ) : null}
          </div>
          <FleetSection title="Needs attention">
            {attention.length === 0 ? (
              <p className="text-sm text-slate-600">Nothing is waiting. Expiries and workshop vehicles will list here.</p>
            ) : (
              <ul className="space-y-2">
                {attention.map((item) => (
                  <li key={item} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </FleetSection>
          <FleetSection title="Setup">
            <SetupList {...props} />
          </FleetSection>
        </>
      )}
    </main>
  );
}

function fleetRollup(rows: VehicleCpk[]): { value: string; hint: string } {
  const ready = rows.filter((row) => row.status === 'ok' && row.fully_loaded_per_km != null && row.total_km);
  if (!ready.length) return { value: 'Not enough data', hint: rows[0]?.next_step || 'Add two odometer readings at least 7 days apart' };
  const km = ready.reduce((sum, row) => sum + (row.total_km || 0), 0);
  const cents = ready.reduce((sum, row) => sum + (row.total_cents || 0), 0);
  const perKm = km > 0 ? cents / km / 100 : null;
  const partial = ready.some((row) => row.completeness !== 'complete');
  return { value: `${formatPerKm(perKm)}/km`, hint: partial ? 'Partial' : 'Complete · last full month' };
}

function attentionRows(props: FleetDeskProps): string[] {
  const items: Array<{ rank: number; label: string }> = [];
  for (const row of props.book.compliance) {
    const state = complianceStatus(row.expires_on, props.today, props.book.workspace.expiring_window_days);
    if (state === 'expired') items.push({ rank: 0, label: `${row.kind.replaceAll('_', ' ')} · ${complianceLabel(row.expires_on, props.today, props.book.workspace.expiring_window_days)}` });
    if (state === 'expiring') items.push({ rank: 1, label: `${row.kind.replaceAll('_', ' ')} · ${complianceLabel(row.expires_on, props.today, props.book.workspace.expiring_window_days)}` });
  }
  for (const vehicle of props.book.vehicles) {
    if (vehicle.status === 'workshop' || vehicle.status === 'off_road') {
      items.push({ rank: 2, label: `${vehicle.reg_no} is ${vehicle.status === 'workshop' ? 'in the workshop' : 'off road'}` });
    }
  }
  for (const job of props.book.jobs) {
    if (job.archived_at || job.status === 'cancelled') continue;
    if (!props.book.stops.some((stop) => stop.job_id === job.id)) items.push({ rank: 3, label: `${job.reference} has no stops` });
  }
  return items.sort((a, b) => a.rank - b.rank).map((item) => item.label);
}

function SetupList(props: FleetDeskProps) {
  const steps = [
    ['Workspace name', Boolean(props.book.workspace.display_name)],
    ['First vehicle', props.book.vehicles.length > 0],
    ['First driver', props.book.drivers.length > 0],
    ['First expiry date', props.book.compliance.some((row) => row.expires_on)],
    ['First odometer reading', props.book.odometer_readings.length > 0],
    ['First cost profile', props.book.cost_profiles.length > 0],
    ['First job', props.book.jobs.length > 0],
  ] as const;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {steps.map(([label, done]) => (
        <li key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 text-sm">
          <span>{label}</span>
          <FleetStatusPill tone={done ? 'ok' : 'muted'}>{done ? 'Done' : 'Still to add'}</FleetStatusPill>
        </li>
      ))}
    </ul>
  );
}

function MapView(props: FleetDeskProps) {
  const vehicles = props.book.vehicles.filter((row) => !row.archived_at);
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-map">
      <FleetPageHead
        title="Fleet map"
        detail="Nothing is tracked yet. This page explains where a position can come from later."
        illustration={props.illustrate}
      />
      <Banners {...props} />
      <MapSketchArt />
      <FleetSection title="Position sources">
        <ul className="space-y-3">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">Manual odometer</p>
              <p className="text-sm text-slate-600">Available now. A reading gives last-known distance, not a live dot.</p>
            </div>
            <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>
              Add an odometer reading
            </Link>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">Driver phone</p>
              <p className="text-sm text-slate-600">A consented phone fix during a trip. Not switched on.</p>
            </div>
            <FleetSoonChip />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">GPS file import</p>
              <p className="text-sm text-slate-600">A file of fixes you already hold. Not switched on.</p>
            </div>
            <FleetSoonChip />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">Telematics integrations</p>
              <p className="text-sm text-slate-600">A tracker feed. Not assumed, and not switched on.</p>
            </div>
            <FleetSoonChip />
          </li>
        </ul>
      </FleetSection>
      <FleetSection title="Last known odometer">
        {vehicles.length === 0 ? (
          <FleetEmpty
            title="No vehicles yet"
            hint="Add a vehicle, then record an odometer reading."
            action={
              <Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>
                Add your first vehicle
              </Link>
            }
          />
        ) : (
          <FleetTable
            testId="fleet-odometer-list"
            columns={['Registration', 'Odometer', 'Read', 'Status']}
            rows={vehicles.map((vehicle) => ({
              id: vehicle.id,
              cells: [
                vehicle.reg_no,
                formatKm(vehicle.odometer_km),
                <FleetDate key="d" value={vehicle.odometer_at} />,
                <FleetStatusPill key="s" tone={vehicle.status === 'active' ? 'ok' : 'warn'}>
                  {vehicle.status.replaceAll('_', ' ')}
                </FleetStatusPill>,
              ],
              card: (
                <div>
                  <p className="font-black">{vehicle.reg_no}</p>
                  <p className="text-sm tabular-nums text-slate-600">{formatKm(vehicle.odometer_km)}</p>
                </div>
              ),
            }))}
          />
        )}
      </FleetSection>
    </main>
  );
}

function VehiclesView(props: FleetDeskProps) {
  const cpk = useCpk(props);
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [reg, setReg] = useState('');
  const [odo, setOdo] = useState('');
  const [amount, setAmount] = useState('');
  const rows = props.book.vehicles.filter((vehicle) => {
    if (vehicle.archived_at) return false;
    if (filter !== 'all' && vehicle.status !== filter) return false;
    if (query && !vehicle.reg_no.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const current = props.book.vehicles.find((vehicle) => vehicle.id === open);
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-vehicles">
      <FleetPageHead
        title="Vehicles"
        detail="Registration, status, odometer and, where your role allows it, cost per kilometre."
        illustration={props.illustrate}
        actions={
          props.caps.canEditRegister ? (
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} data-testid="fleet-add-vehicle" onClick={() => { setOpen('new'); setReg(''); }}>
              Add a vehicle
            </button>
          ) : null
        }
      />
      <Banners {...props} />
      <FleetSegmented
        label="Vehicle status"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'workshop', label: 'Workshop' },
          { id: 'off_road', label: 'Off road' },
          { id: 'sold', label: 'Sold' },
        ]}
      />
      <label className={fleetLabel}>
        Search
        <input className={`${fleetField} ${fleetFocus}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Registration" />
      </label>
      {rows.length === 0 ? (
        <FleetEmpty
          title="No vehicles in this view"
          hint="Add a vehicle to start the register."
          illustration={<FleetRegisterArt />}
          action={
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => setOpen('new')}>
              Add your first vehicle
            </button>
          }
        />
      ) : (
        <FleetTable
          testId="fleet-vehicle-table"
          columns={['Registration', 'Kind', 'Status', 'Ownership', 'Odometer', ...(props.caps.seesCosts ? ['CPK'] : [])]}
          rows={rows.map((vehicle) => {
            const metric = cpk.find((row) => row.vehicle_id === vehicle.id);
            return {
              id: vehicle.id,
              cells: [
                <button key="o" type="button" className={`${fleetLink} ${fleetFocus} min-h-11`} data-testid={`fleet-open-${vehicle.reg_no.replace(/\s+/g, '-')}`} onClick={() => setOpen(vehicle.id)}>
                  {vehicle.reg_no}
                </button>,
                vehicle.kind,
                <FleetStatusPill key="s" tone={vehicle.status === 'active' ? 'ok' : vehicle.status === 'sold' ? 'muted' : 'warn'}>
                  {vehicle.status.replaceAll('_', ' ')}
                </FleetStatusPill>,
                vehicle.ownership,
                formatKm(vehicle.odometer_km),
                ...(props.caps.seesCosts
                  ? [
                      <span key="c" className="inline-flex flex-col gap-1">
                        <span className="tabular-nums">{metric?.status === 'ok' ? `${formatPerKm(metric.fully_loaded_per_km)}/km` : 'Not enough data'}</span>
                        <FleetCompletenessChip completeness={metric?.completeness || 'none'} missing={metric?.missing} />
                      </span>,
                    ]
                  : []),
              ],
              card: (
                <button type="button" className="min-h-11 w-full text-left" onClick={() => setOpen(vehicle.id)}>
                  <p className="font-black">{vehicle.reg_no}</p>
                  <p className="text-sm text-slate-600">{vehicle.kind} · {formatKm(vehicle.odometer_km)}</p>
                </button>
              ),
            };
          })}
        />
      )}
      <FleetDrawer open={open != null} title={current ? current.reg_no : 'New vehicle'} onClose={() => setOpen(null)} testId="fleet-vehicle-drawer">
        <div className="space-y-4">
          <section>
            <h3 className="text-sm font-black">Details</h3>
            <label className={fleetLabel}>
              Registration
              <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-reg" value={open === 'new' ? reg : current?.reg_no || ''} onChange={(event) => setReg(event.target.value)} />
            </label>
            {props.caps.canEditRegister ? (
              <button
                type="button"
                className={`${fleetBtn} ${fleetFocus} mt-3`}
                data-testid="fleet-save-vehicle"
                onClick={() => {
                  props.onOp?.(
                    {
                      op: 'vehicle.upsert',
                      payload: {
                        id: current?.id,
                        reg_no: open === 'new' ? reg : current?.reg_no,
                        kind: current?.kind || 'rigid',
                        ownership: current?.ownership || 'owned',
                        status: current?.status || 'active',
                      },
                    },
                    current?.updated_at
                  );
                  setOpen(null);
                }}
              >
                Save vehicle
              </button>
            ) : null}
          </section>
          {current ? (
            <>
              <section>
                <h3 className="text-sm font-black">Compliance</h3>
                <ComplianceList book={props.book} subjectId={current.id} today={props.today} />
              </section>
              <section>
                <h3 className="text-sm font-black">Odometer</h3>
                <ul className="mb-2 space-y-1 text-sm">
                  {props.book.odometer_readings.filter((row) => row.vehicle_id === current.id).map((row) => (
                    <li key={row.id} className="tabular-nums">{formatKm(row.reading_km)} · <FleetDate value={row.read_at} /></li>
                  ))}
                </ul>
                {props.caps.canEditRegister ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-odometer-km" inputMode="decimal" value={odo} onChange={(event) => setOdo(event.target.value)} placeholder="Reading" />
                    <button
                      type="button"
                      className={`${fleetBtn} ${fleetFocus}`}
                      data-testid="fleet-save-odometer"
                      onClick={() => {
                        props.onOp?.({ op: 'odometer.add', payload: { vehicle_id: current.id, reading_km: Number(odo), read_at: props.today } });
                        setOdo('');
                      }}
                    >
                      Add reading
                    </button>
                  </div>
                ) : null}
              </section>
              {props.caps.seesCosts ? (
                <section>
                  <h3 className="text-sm font-black">Costs and profile</h3>
                  <p className="text-sm text-slate-600">Purchase, standing costs and tyre mode live on the cost profile. The ledger is for fuel, tolls and maintenance.</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-cost-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount in cents" />
                    <button
                      type="button"
                      className={`${fleetBtn} ${fleetFocus}`}
                      data-testid="fleet-save-cost"
                      onClick={() => {
                        props.onOp?.({
                          op: 'cost_entry.add',
                          payload: { vehicle_id: current.id, category: 'maintenance', amount_cents: Number(amount), occurred_on: props.illustrate ? '2024-06-15' : props.today, vat_claimable: true },
                        });
                        setAmount('');
                      }}
                    >
                      Add cost entry
                    </button>
                  </div>
                </section>
              ) : null}
              {props.caps.seesCosts ? <CpkCard metric={cpk.find((row) => row.vehicle_id === current.id) || null} caps={props.caps} /> : null}
            </>
          ) : null}
        </div>
      </FleetDrawer>
    </main>
  );
}

function CpkCard({ metric, caps }: { metric: VehicleCpk | null; caps: FleetCapabilities }) {
  if (!metric || metric.status !== 'ok') {
    return (
      <section data-testid="fleet-cpk-card">
        <h3 className="text-sm font-black">CPK card</h3>
        <p className="text-sm text-slate-600">{metric?.message || 'Not enough data'}</p>
        <p className="text-sm text-slate-600">{metric?.next_step}</p>
      </section>
    );
  }
  return (
    <section className="space-y-2" data-testid="fleet-cpk-card">
      <h3 className="text-sm font-black">CPK card</h3>
      <p className="text-lg font-black tabular-nums text-slate-900">{formatPerKm(metric.fully_loaded_per_km)}/km fully loaded</p>
      <p className="text-sm tabular-nums text-slate-600">Operating {formatPerKm(metric.operating_per_km)}/km · source {metric.distance_source}{metric.interpolated ? ' · estimated' : ''}</p>
      <FleetCompletenessChip completeness={metric.completeness} missing={metric.missing} />
      <FleetVariancePill status={metric.variance_status} />
      <ul className="text-sm text-slate-700">
        <li>Running <FleetMoney cents={metric.running_cents} /></li>
        <li>Standing <FleetMoney cents={metric.standing_cents} /></li>
        {caps.seesDriverPay ? null : <li className="text-slate-500">Driver pay is hidden for this role.</li>}
        <li>Capital <FleetMoney cents={metric.capital_cents} /></li>
        <li>Overhead <FleetMoney cents={metric.overhead_cents} /></li>
      </ul>
      <p className="text-sm tabular-nums">{metric.litres_per_100km == null ? 'Fuel efficiency not recorded' : formatLitresPer100(metric.litres_per_100km)}</p>
      {metric.distance_warnings.map((warning) => (
        <p key={warning} className="text-sm text-slate-600">{warning}</p>
      ))}
      {metric.next_step ? <p className="text-sm font-bold text-slate-800">Next: {metric.next_step}</p> : null}
    </section>
  );
}

function ComplianceList({ book, subjectId, today }: { book: FleetBook; subjectId: string; today: string }) {
  const rows = book.compliance.filter((row) => row.subject_id === subjectId);
  if (!rows.length) return <p className="text-sm text-slate-600">No dates yet.</p>;
  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const state = complianceStatus(row.expires_on, today, book.workspace.expiring_window_days);
        const tone = state === 'expired' ? 'bad' : state === 'expiring' ? 'warn' : state === 'valid' ? 'ok' : 'muted';
        return (
          <li key={row.id}>
            <FleetStatusPill tone={tone}>{complianceLabel(row.expires_on, today, book.workspace.expiring_window_days)}</FleetStatusPill>
          </li>
        );
      })}
    </ul>
  );
}

function DriversView(props: FleetDeskProps) {
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const current = props.book.drivers.find((row) => row.id === open);
  const rows = props.book.drivers.filter((row) => !row.archived_at);
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-drivers">
      <FleetPageHead
        title="Drivers"
        detail="Name, contact, employment and licence code. Identity numbers are not stored."
        illustration={props.illustrate}
        actions={
          props.caps.canEditRegister ? (
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} data-testid="fleet-add-driver" onClick={() => { setOpen('new'); setName(''); }}>
              Add a driver
            </button>
          ) : null
        }
      />
      <Banners {...props} />
      {rows.length === 0 ? (
        <FleetEmpty
          title="No drivers yet"
          hint="Add a driver when you are ready. The form has no identity-number field."
          action={<button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => setOpen('new')}>Add a driver</button>}
        />
      ) : (
        <FleetTable
          columns={['Name', 'Employment', 'Licence code', 'Status']}
          rows={rows.map((driver) => ({
            id: driver.id,
            cells: [
              <button key="n" type="button" className={`${fleetLink} ${fleetFocus} min-h-11`} onClick={() => setOpen(driver.id)}>{driver.full_name}</button>,
              driver.employment.replaceAll('_', ' '),
              driver.licence_code || '—',
              <FleetStatusPill key="s" tone={driver.status === 'active' ? 'ok' : 'muted'}>{driver.status.replaceAll('_', ' ')}</FleetStatusPill>,
            ],
            card: <button type="button" className="min-h-11 text-left font-black" onClick={() => setOpen(driver.id)}>{driver.full_name}</button>,
          }))}
        />
      )}
      <FleetDrawer open={open != null} title={current ? current.full_name : 'New driver'} onClose={() => setOpen(null)}>
        <label className={fleetLabel}>
          Name
          <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-driver-name" value={open === 'new' ? name : current?.full_name || ''} onChange={(event) => setName(event.target.value)} />
        </label>
        {props.caps.canEditRegister ? (
          <button
            type="button"
            className={`${fleetBtn} ${fleetFocus} mt-3`}
            data-testid="fleet-save-driver"
            onClick={() => {
              props.onOp?.(
                { op: 'driver.upsert', payload: { id: current?.id, full_name: open === 'new' ? name : name || current?.full_name, employment: current?.employment || 'employee', status: current?.status || 'active', licence_code: current?.licence_code || '', email: current?.email || '' } },
                current?.updated_at
              );
              setOpen(null);
            }}
          >
            Save driver
          </button>
        ) : null}
        {current ? (
          <section className="mt-4 space-y-2">
            <h3 className="text-sm font-black">Dates</h3>
            <ComplianceList book={props.book} subjectId={current.id} today={props.today} />
            {props.caps.canEditRegister ? (
              <>
                <label className={fleetLabel}>
                  Driving licence expiry
                  <input className={`${fleetField} ${fleetFocus}`} data-testid="fleet-compliance-expiry" type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
                </label>
                <button
                  type="button"
                  className={`${fleetBtn} ${fleetFocus}`}
                  data-testid="fleet-save-compliance"
                  onClick={() => {
                    props.onOp?.({
                      op: 'compliance.upsert',
                      payload: { subject_kind: 'driver', subject_id: current.id, kind: 'driver_licence', expires_on: expiry },
                    });
                    setExpiry('');
                  }}
                >
                  Save date
                </button>
              </>
            ) : null}
          </section>
        ) : null}
      </FleetDrawer>
    </main>
  );
}

function JobsView(props: FleetDeskProps) {
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [filter, setFilter] = useState('all');
  const [customer, setCustomer] = useState('');
  const current = props.book.jobs.find((row) => row.id === open);
  const rows = props.book.jobs.filter((job) => !job.archived_at && (filter === 'all' || job.status === filter));
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-jobs">
      <FleetPageHead
        title="Jobs"
        detail="A job holds the customer, the stops and the cargo. Dispatch and proof of delivery are not switched on."
        illustration={props.illustrate}
        actions={
          props.caps.canEditRegister ? (
            <button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => setOpen('new')}>Create a job</button>
          ) : null
        }
      />
      <Banners {...props} />
      <FleetSegmented
        label="Job status"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'All' },
          { id: 'draft', label: 'Draft' },
          { id: 'booked', label: 'Booked' },
          { id: 'cancelled', label: 'Cancelled' },
        ]}
      />
      {rows.length === 0 ? (
        <FleetEmpty
          title="No jobs yet"
          hint="Create a job with a pickup and a delivery. Assignment comes later."
          action={<button type="button" className={`${fleetBtn} ${fleetFocus}`} onClick={() => setOpen('new')}>Create a job</button>}
        />
      ) : (
        <FleetTable
          columns={['Reference', 'Customer', 'Status', ...(props.caps.seesRates ? ['Price'] : [])]}
          rows={rows.map((job) => ({
            id: job.id,
            cells: [
              <button key="r" type="button" className={`${fleetLink} ${fleetFocus} min-h-11`} onClick={() => setOpen(job.id)}>{job.reference}</button>,
              job.customer_name || '—',
              <FleetStatusPill key="s" tone={job.status === 'cancelled' ? 'muted' : 'ok'}>{job.status}</FleetStatusPill>,
              ...(props.caps.seesRates ? [<FleetMoney key="p" cents={job.price_cents} />] : []),
            ],
            card: (
              <button type="button" className="min-h-11 text-left" onClick={() => setOpen(job.id)}>
                <p className="font-black">{job.reference}</p>
                <p className="text-sm text-slate-600">{job.customer_name}</p>
              </button>
            ),
          }))}
        />
      )}
      <FleetSection title="Still to come">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FleetSoonChip />
            <DispatchArt />
          </div>
          <div>
            <FleetSoonChip />
            <PodArt />
          </div>
        </div>
      </FleetSection>
      <FleetDrawer open={open != null} title={current ? current.reference : 'New job'} onClose={() => setOpen(null)} testId="fleet-job-drawer">
        <label className={fleetLabel}>
          Customer name
          <input className={`${fleetField} ${fleetFocus}`} value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Or pick a customer later" />
        </label>
        {props.caps.seesRates ? <p className="mt-2 text-sm text-slate-600">Price is visible for this role.</p> : <p className="mt-2 text-sm text-slate-600">Prices are hidden for this role.</p>}
        {current ? (
          <ul className="mt-3 space-y-1 text-sm">
            {props.book.stops.filter((stop) => stop.job_id === current.id).map((stop) => (
              <li key={stop.id}>{stop.kind} · {stop.place_name}</li>
            ))}
          </ul>
        ) : null}
        {props.caps.canEditRegister ? (
          <button
            type="button"
            className={`${fleetBtn} ${fleetFocus} mt-3`}
            onClick={() => {
              props.onOp?.(
                {
                  op: 'job.upsert',
                  payload: {
                    id: current?.id,
                    customer_name: customer || current?.customer_name || 'Sample Retailer',
                    status: current?.status || 'draft',
                    stops: current
                      ? props.book.stops.filter((stop) => stop.job_id === current.id)
                      : [{ kind: 'pickup', place_name: 'Sample Depot' }, { kind: 'delivery', place_name: 'Sample DC' }],
                  },
                },
                current?.updated_at
              );
              setOpen(null);
            }}
          >
            Save job
          </button>
        ) : null}
      </FleetDrawer>
    </main>
  );
}

function CpkView(props: FleetDeskProps) {
  const cpk = useCpk(props);
  const vehicles = props.book.vehicles.filter((row) => !row.archived_at);
  const withReadings = vehicles.filter((vehicle) => props.book.odometer_readings.filter((row) => row.vehicle_id === vehicle.id).length >= 2).length;
  const missingProfiles = vehicles.filter((vehicle) => !props.book.cost_profiles.some((row) => row.vehicle_id === vehicle.id)).length;
  const period = periodFor(props.periodId, props.today, props.book.workspace.cpk_window_days);
  const poolMonth = `${period.from.slice(0, 7)}-01`;
  const hasPool = props.book.overhead_pools.some((row) => {
    const start = `${row.period_month.slice(0, 7)}-01`;
    const end = nextMonth(start);
    return start < period.to && end > period.from;
  });
  const fleet = fleetRollup(cpk);
  if (!props.caps.seesCosts) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4" data-testid="fleet-cpk">
        <FleetPageHead title="CPK" detail="Cost per kilometre is hidden for this role." illustration={props.illustrate} />
        <FleetEmpty
          title="Nothing to show here"
          hint="An owner or office role can open cost per kilometre. You can still work with vehicles, drivers and jobs."
          action={<Link className={`${fleetBtn} ${fleetFocus}`} href={props.hrefBase}>Back to command</Link>}
        />
      </main>
    );
  }
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-cpk">
      <FleetPageHead
        title="CPK"
        detail="Fully loaded cost per kilometre from your own ledger, profiles and targets. No outside benchmark."
        illustration={props.illustrate}
      />
      <Banners {...props} />
      <FleetSegmented
        label="Period"
        value={props.periodId}
        onChange={(id) => props.onPeriod?.(id as PeriodId)}
        options={[
          { id: 'mtd', label: 'Month to date' },
          { id: 'last', label: 'Last full month' },
          { id: 'trail', label: 'Trailing 90 days' },
        ]}
      />
      {vehicles.length === 0 ? (
        <FleetEmpty
          title="No cost per kilometre yet"
          hint="Add a vehicle and a cost profile. Until then the sample waterfall below is only an illustration."
          illustration={<CpkWaterfallArt />}
          action={<Link className={`${fleetBtn} ${fleetFocus}`} href={`${props.hrefBase}/vehicles`}>Add a cost profile</Link>}
        />
      ) : (
        <>
          <div data-testid="fleet-cpk-headline">
            <FleetStat label="Fully loaded" value={fleet.value} hint={fleet.hint} testId="fleet-cpk-value" />
          </div>
          <FleetTable
            columns={['Vehicle', 'CPK', 'Variance', 'Source', 'L/100 km']}
            rows={vehicles.map((vehicle) => {
              const metric = cpk.find((row) => row.vehicle_id === vehicle.id);
              return {
                id: vehicle.id,
                cells: [
                  vehicle.reg_no,
                  metric?.status === 'ok' ? `${formatPerKm(metric.fully_loaded_per_km)}/km` : metric?.message || 'Not enough data',
                  <FleetVariancePill key="v" status={metric?.variance_status || 'no_target'} />,
                  metric?.distance_source || 'none',
                  formatLitresPer100(metric?.litres_per_100km),
                ],
                card: (
                  <div>
                    <p className="font-black">{vehicle.reg_no}</p>
                    <p className="tabular-nums text-sm">{metric?.status === 'ok' ? `${formatPerKm(metric.fully_loaded_per_km)}/km` : 'Not enough data'}</p>
                    <FleetCompletenessChip completeness={metric?.completeness || 'none'} missing={metric?.missing} />
                  </div>
                ),
              };
            })}
          />
          <FleetSection title="Data completeness">
            <ul className="space-y-2 text-sm font-bold text-slate-800">
              <li>{withReadings} of {vehicles.length} vehicles have two odometer readings. <Link className={fleetLink} href={`${props.hrefBase}/vehicles`}>Add a reading</Link></li>
              <li>{missingProfiles === 0 ? 'Every vehicle has a cost profile.' : `No cost profile for ${missingProfiles} ${missingProfiles === 1 ? 'vehicle' : 'vehicles'}.`} <Link className={fleetLink} href={`${props.hrefBase}/vehicles`}>Open vehicles</Link></li>
              <li>{hasPool ? 'An overhead pool covers this period.' : 'No overhead pool covers this period.'}</li>
            </ul>
          </FleetSection>
          {props.caps.canEditSettings ? (
            <FleetSection title="Target and overhead">
              <p className="mb-2 text-sm text-slate-600">Targets are the company&apos;s own figures.</p>
              <button
                type="button"
                className={`${fleetGhost} ${fleetFocus}`}
                onClick={() => props.onOp?.({ op: 'cpk_target.set', payload: { scope_kind: 'fleet', scope_ref: '', layer: 'fully_loaded', target_cents_per_km: 1550, effective_from: props.today } })}
              >
                Save a fleet target
              </button>
              <button
                type="button"
                className={`${fleetGhost} ${fleetFocus} ml-2`}
                onClick={() => props.onOp?.({ op: 'overhead_pool.set', payload: { period_month: poolMonth, amount_cents: 0, basis: props.book.workspace.overhead_basis } })}
              >
                Save this month&apos;s overhead
              </button>
            </FleetSection>
          ) : null}
        </>
      )}
      <details className="rounded-3xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-black">How this is calculated</summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
          <p>Running costs come from the ledger on the day they happened: fuel, tolls, maintenance and tyres. Standing costs and capital accrue from the vehicle profile for each day the vehicle is in the fleet, including workshop days. Overhead is a monthly pool shared by vehicle-days, kilometres or revenue.</p>
          <p>Distance uses completed trip readings when they exist, otherwise odometer pairs, otherwise GPS-derived distance. Planned kilometres are never used. A partial result names what is still missing. Targets are yours. There is no external benchmark.</p>
        </div>
      </details>
    </main>
  );
}

function SettingsView(props: FleetDeskProps) {
  const [phrase, setPhrase] = useState('');
  const [name, setName] = useState(props.book.workspace.display_name);
  if (!props.caps.canEditSettings && props.role !== 'owner' && props.role !== 'manager') {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4" data-testid="fleet-settings">
        <FleetPageHead title="Settings" detail="Settings are read-only for this role." illustration={props.illustrate} />
        <FleetEmpty
          title="You can look, not change"
          hint="An owner or manager edits the workspace. Your role still sees the explainer below."
          action={<Link className={`${fleetBtn} ${fleetFocus}`} href={props.hrefBase}>Back to command</Link>}
        />
        <RoleExplainer />
      </main>
    );
  }
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4" data-testid="fleet-settings">
      <FleetPageHead title="Settings" detail="Workspace, expiry window, cost settings and who can see prices." illustration={props.illustrate} />
      <Banners {...props} />
      <FleetSection title="Workspace">
        <label className={fleetLabel}>
          Display name
          <input className={`${fleetField} ${fleetFocus}`} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button
          type="button"
          className={`${fleetBtn} ${fleetFocus} mt-3`}
          onClick={() =>
            props.onOp?.(
              { op: 'settings.update', payload: { display_name: name, expiring_window_days: props.book.workspace.expiring_window_days, cpk_window_days: props.book.workspace.cpk_window_days, cpk_min_km: props.book.workspace.cpk_min_km } },
              props.book.workspace.updated_at
            )
          }
        >
          Save settings
        </button>
      </FleetSection>
      <FleetSection title="What each role can do">
        <RoleExplainer />
      </FleetSection>
      {props.caps.canOwnerSwitches ? (
        <FleetSection title="Owner switches">
          <p className="text-sm text-slate-600">Dispatchers see job prices only when you turn that on. It is off to start.</p>
          <button
            type="button"
            className={`${fleetGhost} ${fleetFocus} mt-2`}
            onClick={() =>
              props.onOp?.(
                { op: 'settings.update', payload: { dispatcher_sees_rates: !props.book.workspace.dispatcher_sees_rates } },
                props.book.workspace.updated_at
              )
            }
          >
            {props.book.workspace.dispatcher_sees_rates ? 'Hide prices from dispatchers' : 'Let dispatchers see prices'}
          </button>
          <p className="mt-3 text-sm text-slate-600">File retention applies when proof-of-delivery storage arrives. The suggested holding period is 5 years.</p>
          <label className={`${fleetLabel} mt-4`}>
            Type ENABLE REAL DATA to leave demo-data mode
            <input className={`${fleetField} ${fleetFocus}`} value={phrase} onChange={(event) => setPhrase(event.target.value)} />
          </label>
          <button type="button" className={`${fleetBtn} ${fleetFocus} mt-3`} onClick={() => props.onOp?.({ op: 'real_data.confirm', payload: { phrase } })}>
            Confirm real data
          </button>
        </FleetSection>
      ) : (
        <p className="text-sm text-slate-600">Retention, price visibility and the real-data switch are owner-only.</p>
      )}
    </main>
  );
}

function RoleExplainer() {
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      <li><span className="font-black">Owner</span> — fleet, costs, prices, settings, real-data confirmation.</li>
      <li><span className="font-black">Manager</span> — fleet and costs. No invoicing and no real-data switch.</li>
      <li><span className="font-black">Dispatcher</span> — vehicles, drivers and jobs. No costs. Prices only if the owner allows them.</li>
      <li><span className="font-black">Office</span> — reads costs and prices. Driver pay stays hidden.</li>
      <li><span className="font-black">Viewer</span> — reads the register and prices. No costs.</li>
    </ul>
  );
}
