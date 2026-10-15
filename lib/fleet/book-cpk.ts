/**
 * FleetAdvisor® book → cost engine. Revenue and loaded kilometres stay empty
 * until trips exist. Planned kilometres are not read.
 */
import { computeFleetCpk, type CpkPeriod, type FleetCpkInput, type VehicleCpk } from './cpk';
import type { FleetBook } from './types';

export function cpkInputFromBook(book: FleetBook, period: CpkPeriod): FleetCpkInput {
  return {
    period,
    minKm: book.workspace.cpk_min_km,
    finesInCpk: book.workspace.fines_in_cpk,
    tyreModeDefault: book.workspace.tyre_mode_default,
    includeSubcontractors: book.workspace.overhead_include_subcontractors,
    vehicles: book.vehicles
      .filter((vehicle) => !vehicle.archived_at)
      .map((vehicle) => ({
        id: vehicle.id,
        kind: vehicle.kind,
        ownership: vehicle.ownership,
        readings: book.odometer_readings
          .filter((row) => row.vehicle_id === vehicle.id)
          .map((row) => ({ reading_km: row.reading_km, read_at: row.read_at })),
      })),
    entries: book.cost_entries.map((row) => ({
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
