'use client';

import { AgreementExperience } from '@/components/sales/AgreementExperience';

/** Agreement document first. Privy mounts later, and only when a session or click needs it. */
export default function SalesAgreementLayout({ children }: { children: React.ReactNode }) {
  return <AgreementExperience>{children}</AgreementExperience>;
}
