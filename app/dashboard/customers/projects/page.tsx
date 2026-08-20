'use client';

import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { TradeProjectsDesk } from '@/components/projects/TradeProjectsDesk';

export default function CustomerProjectsPage() {
  return (
    <CompanyRequired>
      <CustomersPage>
        <CustomersHeader
          title="Projects"
          titleAccent="together"
          description="Generic waterfall projects on this customer’s book — slice the period, read the metrics, run the Gantt and tasks. They see the same work on their portal."
        />
        <TradeProjectsDesk kind="customer" />
      </CustomersPage>
    </CompanyRequired>
  );
}
