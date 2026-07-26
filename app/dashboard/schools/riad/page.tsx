'use client';

import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import SchoolRiadRegister from '@/components/schools/SchoolRiadRegister';

export default function SchoolRiadPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School RIAD log"
        titleAccent="Lead"
        description="Risks, issues, actions & decisions — kitchen safety, facilities, staffing, and NSNP delivery in one place principals actually use."
      />
      <SchoolRiadRegister companyId={companyId} />
    </SchoolsPage>
  );
}
