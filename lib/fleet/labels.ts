/** Visible labels. Raw enum values stay in the data, not on the screen. */

const KIND: Record<string, string> = {
  rigid: 'Rigid',
  tractor: 'Tractor',
  trailer: 'Trailer',
  tipper: 'Tipper',
  van: 'Van',
  other: 'Other',
};

const OWNERSHIP: Record<string, string> = {
  owned: 'Owned',
  leased: 'Leased',
  subcontractor: 'Subcontractor',
};

const VEHICLE_STATUS: Record<string, string> = {
  active: 'Active',
  workshop: 'Workshop',
  off_road: 'Off road',
  sold: 'Sold',
};

const EMPLOYMENT: Record<string, string> = {
  employee: 'Employee',
  contractor: 'Contractor',
  owner_operator: 'Owner-operator',
};

const DRIVER_STATUS: Record<string, string> = {
  active: 'Active',
  on_leave: 'On leave',
  inactive: 'Inactive',
};

const JOB_STATUS: Record<string, string> = {
  draft: 'Draft',
  booked: 'Booked',
  planned: 'Planned',
  in_transit: 'In transit',
  delivered: 'Delivered',
  invoiced: 'Invoiced',
  cancelled: 'Cancelled',
};

const COMPLIANCE: Record<string, string> = {
  licence_disc: 'Licence disc',
  roadworthy: 'Roadworthy',
  operator_card: 'Operator card',
  insurance: 'Insurance',
  cross_border_permit: 'Cross-border permit',
  abnormal_permit: 'Abnormal permit',
  other_permit: 'Other permit',
  driver_licence: 'Driving licence',
  prdp: 'PrDP',
  medical: 'Medical',
  induction: 'Induction',
  other: 'Other',
};

const ROLE: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  dispatcher: 'Dispatcher',
  office: 'Office',
  viewer: 'Viewer',
  none: 'No access',
};

function named(table: Record<string, string>, value: string): string {
  return table[value] || value;
}

export const vehicleKindLabel = (value: string) => named(KIND, value);
export const ownershipLabel = (value: string) => named(OWNERSHIP, value);
export const vehicleStatusLabel = (value: string) => named(VEHICLE_STATUS, value);
export const employmentLabel = (value: string) => named(EMPLOYMENT, value);
export const driverStatusLabel = (value: string) => named(DRIVER_STATUS, value);
export const jobStatusLabel = (value: string) => named(JOB_STATUS, value);
export const complianceKindLabel = (value: string) => named(COMPLIANCE, value);
const RUNNING: Record<string, string> = {
  fuel: 'Fuel',
  toll: 'Toll',
  border: 'Border',
  maintenance: 'Maintenance',
  tyres: 'Tyres',
  other_running: 'Other running',
  fine: 'Fine',
  other: 'Other',
};

const DISTANCE: Record<string, string> = {
  trips: 'Trips',
  odometer: 'Odometer',
  gps: 'GPS',
  none: 'No distance yet',
};

export const runningCategoryLabel = (value: string) => named(RUNNING, value);
export const distanceSourceLabel = (value: string) => named(DISTANCE, value);
export const fleetRoleLabel = (value: string) => named(ROLE, value);
