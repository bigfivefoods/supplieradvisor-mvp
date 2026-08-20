'use client';

import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { TradeProjectsDesk } from '@/components/projects/TradeProjectsDesk';

export default function SupplierProjectsPage() {
  return (
    <CompanyRequired>
      <SuppliersPage>
        <SuppliersHeader
          title="Projects"
          titleAccent="together"
          description="Generic waterfall projects on this supplier’s book — slice the period, read the metrics, run the Gantt and tasks. They see the same work on their portal."
        />
        <TradeProjectsDesk kind="supplier" />
      </SuppliersPage>
    </CompanyRequired>
  );
}
