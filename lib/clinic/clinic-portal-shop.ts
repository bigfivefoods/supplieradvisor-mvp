import { isSystemPersonalService } from '@/lib/clinic/appointment-kind';

export type ClinicPortalShopItem = {
  id: string;
  kind: 'service' | 'package';
  name: string;
  description?: string;
  price_zar?: number | null;
  duration_min?: number | null;
  sessions_total?: number | null;
};

export type ClinicPortalCarePack = {
  id: string;
  label?: string;
  remaining: number;
  sessions_total?: number;
  sessions_used?: number;
  expires_at?: string | null;
  status?: string;
};

export function clinicPortalShop(store: {
  services?: Array<{
    id: string;
    code?: string;
    name: string;
    description?: string;
    price_zar?: number | null;
    default_duration_min?: number | null;
    active?: boolean;
  }>;
  packages?: Array<{
    id: string;
    name: string;
    description?: string;
    price_zar?: number | null;
    sessions_total?: number | null;
    active?: boolean;
  }>;
  settings?: { show_pricing?: boolean };
}): ClinicPortalShopItem[] {
  if (store.settings?.show_pricing === false) return [];
  const packages = (store.packages || [])
    .filter((p) => p.active !== false)
    .map((p) => ({
      id: p.id,
      kind: 'package' as const,
      name: p.name,
      description: p.description,
      price_zar: p.price_zar ?? null,
      sessions_total: p.sessions_total ?? null,
    }));
  const services = (store.services || [])
    .filter((s) => s.active !== false && !isSystemPersonalService(s.code))
    .map((s) => ({
      id: s.id,
      kind: 'service' as const,
      name: s.name,
      description: s.description,
      price_zar: s.price_zar ?? null,
      duration_min: s.default_duration_min ?? null,
    }));
  return [...packages, ...services];
}
