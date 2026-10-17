import type { AdvisorFlowDef, CoreFlowModuleId } from '../types';
import { CUSTOMERS_FLOW } from './customers';
import { DISTRIBUTION_FLOW } from './distribution';
import { HOME_FLOW } from './home';
import { INVENTORY_FLOW } from './inventory';
import { MANUFACTURING_FLOW } from './manufacturing';
import { ACCOUNTING_FLOW } from './accounting';
import { NETWORK_FLOW } from './network';
import { PEOPLE_FLOW } from './people';
import { PROJECTS_FLOW } from './projects';
import { QUALITY_FLOW } from './quality';
import { SALES_PORTAL_FLOW } from './sales-portal';
import { SHEQ_FLOW } from './sheq';
import { SUPPLIERS_FLOW } from './suppliers';
import { SUSTAINABILITY_FLOW } from './sustainability';

export const CORE_FLOWS: Record<CoreFlowModuleId, AdvisorFlowDef> = {
  home: HOME_FLOW,
  suppliers: SUPPLIERS_FLOW,
  customers: CUSTOMERS_FLOW,
  'sales-portal': SALES_PORTAL_FLOW,
  manufacturing: MANUFACTURING_FLOW,
  distribution: DISTRIBUTION_FLOW,
  inventory: INVENTORY_FLOW,
  quality: QUALITY_FLOW,
  sheq: SHEQ_FLOW,
  projects: PROJECTS_FLOW,
  accounting: ACCOUNTING_FLOW,
  people: PEOPLE_FLOW,
  sustainability: SUSTAINABILITY_FLOW,
  network: NETWORK_FLOW,
};
