import type { AdvisorFlowDef, CoreFlowModuleId } from '../types';
import { CUSTOMERS_FLOW } from './customers';
import { HOME_FLOW } from './home';
import { SALES_PORTAL_FLOW } from './sales-portal';
import { SUPPLIERS_FLOW } from './suppliers';

export const CORE_FLOWS: Record<CoreFlowModuleId, AdvisorFlowDef> = {
  home: HOME_FLOW,
  suppliers: SUPPLIERS_FLOW,
  customers: CUSTOMERS_FLOW,
  'sales-portal': SALES_PORTAL_FLOW,
};
