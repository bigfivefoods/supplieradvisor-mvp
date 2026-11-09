'use client';

import { usePrivy } from '@privy-io/react-auth';
import { Vat201Screen } from '@/components/accounting/Vat201Screen';
import { CompanyRequired } from '@/components/accounting/AccountingShell';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { getSelectedCompanyId } from '@/lib/containers/company';

export default function Vat201Page() {
  return (
    <CompanyRequired>
      <Live />
    </CompanyRequired>
  );
}

function Live() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const { canAccountingWrite, role } = useCompanyRole();
  const canEditSettings = role === 'owner' || role === 'admin' || role === 'finance';
  return (
    <Vat201Screen
      companyId={companyId}
      privyUserId={privyUserId}
      canEditSettings={canEditSettings}
      canFile={canAccountingWrite}
    />
  );
}
