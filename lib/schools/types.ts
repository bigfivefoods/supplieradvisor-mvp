/**
 * Schools / NSNP domain types
 */

export const LEARNER_VERIFY_STATUSES = [
  'draft',
  'school_verified',
  'attested',
  'flagged',
  'left',
] as const;
export type LearnerVerifyStatus = (typeof LEARNER_VERIFY_STATUSES)[number];

export const STAFF_ROLES = [
  'principal',
  'deputy',
  'nsnp_coordinator',
  'kitchen_manager',
  'teacher',
  'clerk',
  'other',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;

export type SchoolProfile = {
  id: number;
  profile_id: number;
  emis_number: string | null;
  school_name: string;
  school_type: string | null;
  phase: string | null;
  province: string | null;
  district: string | null;
  circuit: string | null;
  quintile: number | null;
  urban_rural: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  principal_name: string | null;
  principal_email: string | null;
  principal_phone: string | null;
  nsnp_coordinator_name: string | null;
  nsnp_coordinator_email: string | null;
  kitchen_warehouse_id: number | null;
  has_on_site_kitchen: boolean;
  feeding_breakfast: boolean;
  feeding_lunch: boolean;
  feeding_snack: boolean;
  learner_count_enrolled: number;
  learner_count_nsnp_eligible: number;
  learner_count_verified: number;
  staff_count: number;
  status: string;
  metadata?: Record<string, unknown> | null;
};

export type ApprovedProduct = {
  id: number;
  brand_id: number | null;
  category: string;
  name: string;
  brand_name: string;
  sku: string | null;
  pack_size: string | null;
  uom: string | null;
  barcode: string | null;
  province: string | null;
  energy_kcal: number | null;
  protein_g: number | null;
  active: boolean;
};

export type SchoolPoLine = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  qty: number;
  unit_price: number;
  uom: string;
};

export type ReceiptLine = {
  approved_product_id: number | null;
  product_name: string;
  brand_name: string;
  qty: number;
  uom: string;
  lot?: string | null;
  expiry?: string | null;
  approved: boolean;
};

/** Prize pillar weights (sum = 100) */
export const PRIZE_WEIGHTS = {
  approvedBrand: 40,
  zeroNonapproved: 15,
  menuAdherence: 15,
  feedingCompleteness: 15,
  stockDiscipline: 10,
  dataQuality: 5,
} as const;
