/**
 * FleetAdvisor® read of Ship. Explicit columns, one company, no writes.
 */
import { getSupabaseAdmin } from '../supabase/admin';
import { SHIP_DRIVER_COLUMNS, SHIP_VEHICLE_COLUMNS, type ShipDriverRow, type ShipVehicleRow } from './import-ship';

const VEHICLE_SELECT = SHIP_VEHICLE_COLUMNS.join(', ');
const DRIVER_SELECT = SHIP_DRIVER_COLUMNS.join(', ');

export async function readShipVehicles(companyId: number): Promise<{ ok: true; rows: ShipVehicleRow[] } | { ok: false; missing: boolean }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('distribution_vehicles').select(VEHICLE_SELECT).eq('profile_id', companyId).limit(500);
  if (error) return { ok: false, missing: /does not exist|schema cache/i.test(error.message || '') };
  return { ok: true, rows: (data || []) as unknown as ShipVehicleRow[] };
}

export async function readShipDrivers(companyId: number): Promise<{ ok: true; rows: ShipDriverRow[] } | { ok: false; missing: boolean }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('distribution_drivers').select(DRIVER_SELECT).eq('profile_id', companyId).limit(500);
  if (error) return { ok: false, missing: /does not exist|schema cache/i.test(error.message || '') };
  return { ok: true, rows: (data || []) as unknown as ShipDriverRow[] };
}
