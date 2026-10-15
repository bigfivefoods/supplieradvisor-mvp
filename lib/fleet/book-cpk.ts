/**
 * FleetAdvisor® book → cost engine. Trip days come from recorded trips, or from
 * booked job windows when no trips are on file. Planned kilometres are not read.
 */
import { addDays, computeFleetCpk, type CpkPeriod, type FleetCpkInput, type VehicleCpk } from './cpk';
import type { FleetBook, FleetJob } from './types';

function eachDate(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 366; day = addDays(day, 1)) days.push(day);
  return days;
}

function tripWindow(book: FleetBook, job: FleetJob): string[] {
  const stops = book.stops.filter((stop) => stop.job_id === job.id && stop.window_start);
  const days = new Set<string>();
  for (const stop of stops) {
    const start = (stop.window_start || '').slice(0, 10);
    const end = (stop.window_end || stop.window_start || '').slice(0, 10);
    if (!start) continue;
    for (const day of eachDate(start, end >= start ? end : start)) days.add(day);
  }
  return [...days];
}

export function cpkInputFromBook(book: FleetBook, period: CpkPeriod): FleetCpkInput {
  return {
    period,
    minKm: book.workspace.cpk_min_km,
    finesInCpk: book.workspace.fines_in_cpk,
    tyreModeDefault: book.workspace.tyre_mode_default,
    includeSubcontractors: book.workspace.overhead_include_subcontractors,
    vehicles: book.vehicles
      .filter((vehicle) => !vehicle.archived_at)
      .map((vehicle) => {
        const recorded = book.trips.filter((trip) => trip.vehicle_id === vehicle.id);
        const jobs = book.jobs.filter((job) => job.vehicle_id === vehicle.id && job.status !== 'cancelled' && job.status !== 'draft' && !job.archived_at);
        const days = recorded.length ? recorded.map((trip) => trip.on_date.slice(0, 10)) : jobs.flatMap((job) => tripWindow(book, job));
        const loaded = recorded.reduce((sum, trip) => sum + (trip.loaded_km || 0), 0);
        const revenue = jobs.reduce((sum, job) => sum + (job.price_cents || 0), 0);
        return {
          id: vehicle.id,
          kind: vehicle.kind,
          ownership: vehicle.ownership,
          trip_days: days,
          loaded_km: recorded.length ? loaded : null,
          revenue_cents: jobs.length ? revenue : null,
          readings: book.odometer_readings
            .filter((row) => row.vehicle_id === vehicle.id)
            .map((row) => ({ reading_km: row.reading_km, read_at: row.read_at })),
        };
      }),
    entries: book.cost_entries.map((row) => ({
      id: row.id,
      reverses_id: row.reverses_id,
      vehicle_id: row.vehicle_id,
      category: row.category,
      occurred_on: row.occurred_on,
      amount_cents: row.amount_cents,
      vat_cents: row.vat_cents,
      vat_claimable: row.vat_claimable,
      litres: row.litres,
      odometer_km: row.odometer_km,
      full_tank: row.full_tank,
    })),
    profiles: book.cost_profiles.map((row) => ({ ...row })),
    pools: book.overhead_pools.map((row) => ({
      period_month: row.period_month,
      amount_cents: row.amount_cents,
      basis: row.basis,
    })),
    targets: book.cpk_targets.map((row) => ({
      scope_kind: row.scope_kind,
      scope_ref: row.scope_ref,
      layer: row.layer,
      target_cents_per_km: row.target_cents_per_km,
      effective_from: row.effective_from,
    })),
    statusEvents: book.status_events.map((row) => ({
      vehicle_id: row.vehicle_id,
      status: row.status,
      from_at: row.from_at,
    })),
  };
}

export function cpkForBook(book: FleetBook, period: CpkPeriod): VehicleCpk[] {
  return computeFleetCpk(cpkInputFromBook(book, period));
}
