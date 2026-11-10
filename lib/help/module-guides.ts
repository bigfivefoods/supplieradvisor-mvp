/**
 * How-to guides for every sidebar module.
 * Each guide is written from the screens and the server checks.
 */
import { MODULE_NAV, type ModuleNav } from '@/lib/chrome/module-nav';
import { ACCOUNTING_GUIDE } from '@/lib/help/guides/accounting';
import { APPAREL_GUIDE } from '@/lib/help/guides/apparel';
import { COMPANY_GUIDE } from '@/lib/help/guides/company';
import { CONSTRUCTION_GUIDE } from '@/lib/help/guides/construction';
import { CONTAINERS_GUIDE } from '@/lib/help/guides/containers';
import { CROP_GUIDE } from '@/lib/help/guides/crop';
import { CUSTOMERS_GUIDE } from '@/lib/help/guides/customers';
import { DISTRIBUTION_GUIDE } from '@/lib/help/guides/distribution';
import { FLEET_GUIDE } from '@/lib/help/guides/fleet';
import { GUIDE_GUIDE, NETWORK_GUIDE } from '@/lib/help/guides/network';
import { GYM_GUIDE } from '@/lib/help/guides/gym';
import { HEALTH_GUIDE } from '@/lib/help/guides/health';
import { HIRE_GUIDE } from '@/lib/help/guides/hire';
import { HOME_GUIDE } from '@/lib/help/guides/home';
import { IMPACT_GUIDE } from '@/lib/help/guides/impact';
import { INTELLIGENCE_GUIDE } from '@/lib/help/guides/intelligence';
import { INVENTORY_GUIDE } from '@/lib/help/guides/inventory';
import { MANUFACTURING_GUIDE } from '@/lib/help/guides/manufacturing';
import { DENTAL_GUIDE, MEDICAL_GUIDE, PHYSIO_GUIDE, PSYCHIATRY_GUIDE, VET_GUIDE } from '@/lib/help/guides/clinics';
import { OPERATIONS_GUIDE } from '@/lib/help/guides/operations';
import { PEOPLE_GUIDE } from '@/lib/help/guides/people';
import { PLATFORM_GUIDE } from '@/lib/help/guides/platform';
import { PROJECTS_GUIDE } from '@/lib/help/guides/projects';
import { QUALITY_GUIDE } from '@/lib/help/guides/quality';
import { QUARRY_GUIDE } from '@/lib/help/guides/quarry';
import { RECOVER_GUIDE } from '@/lib/help/guides/recover';
import { RETAIL_GUIDE } from '@/lib/help/guides/retail';
import { SALES_GUIDE } from '@/lib/help/guides/sales';
import { SCHOOLS_GUIDE } from '@/lib/help/guides/schools';
import { SHEQ_GUIDE } from '@/lib/help/guides/sheq';
import { SUPPLIERS_GUIDE } from '@/lib/help/guides/suppliers';
import { TRADE_GUIDE } from '@/lib/help/guides/trade';
import type { GuideError, GuideFaq, GuideFeature, GuideNode, ModuleGuide } from '@/lib/help/types';

export type { GuideError, GuideFaq, GuideFeature, GuideNode, ModuleGuide };

const HAND: Record<string, ModuleGuide> = {
  home: HOME_GUIDE,
  platform: PLATFORM_GUIDE,
  'sales-portal': SALES_GUIDE,
  'my-business': COMPANY_GUIDE,
  network: NETWORK_GUIDE,
  suppliers: SUPPLIERS_GUIDE,
  customers: CUSTOMERS_GUIDE,
  containers: CONTAINERS_GUIDE,
  inventory: INVENTORY_GUIDE,
  operations: OPERATIONS_GUIDE,
  manufacturing: MANUFACTURING_GUIDE,
  distribution: DISTRIBUTION_GUIDE,
  accounting: ACCOUNTING_GUIDE,
  people: PEOPLE_GUIDE,
  sheq: SHEQ_GUIDE,
  quality: QUALITY_GUIDE,
  projects: PROJECTS_GUIDE,
  sustainability: IMPACT_GUIDE,
  intelligence: INTELLIGENCE_GUIDE,
  apparelgraph: APPAREL_GUIDE,
  constructiongraph: CONSTRUCTION_GUIDE,
  fleetgraph: FLEET_GUIDE,
  tradegraph: TRADE_GUIDE,
  fieldgraph: CROP_GUIDE,
  quarrygraph: QUARRY_GUIDE,
  fitgraph: GYM_GUIDE,
  physiograph: PHYSIO_GUIDE,
  dentalgraph: DENTAL_GUIDE,
  psychiatrygraph: PSYCHIATRY_GUIDE,
  medicalgraph: MEDICAL_GUIDE,
  vetgraph: VET_GUIDE,
  hiregraph: HIRE_GUIDE,
  retailgraph: RETAIL_GUIDE,
  schools: SCHOOLS_GUIDE,
  health: HEALTH_GUIDE,
  recovergraph: RECOVER_GUIDE,
  guide: GUIDE_GUIDE,
};

function buildOne(mod: ModuleNav): ModuleGuide {
  const guide = HAND[mod.id];
  if (!guide) {
    throw new Error(`No how-to guide for ${mod.id}`);
  }
  return guide;
}

export const MODULE_GUIDES: readonly ModuleGuide[] = MODULE_NAV.map(buildOne);

export function getModuleGuide(id: string): ModuleGuide | null {
  return MODULE_GUIDES.find((guide) => guide.id === id) ?? null;
}
