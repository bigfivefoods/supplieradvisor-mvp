'use client';

import { getSelectedCompanyId } from '@/lib/containers/company';
import { ShipmentBoard } from '@/components/distribution/ShipmentBoard';
import {
  CompanyRequired,
  DistributionHeader,
  DistributionPage,
} from '@/components/distribution/DistributionShell';

export default function InboundPage() {
  return (
    <CompanyRequired>
      <InboundInner />
    </CompanyRequired>
  );
}

function InboundInner() {
  const companyId = getSelectedCompanyId()!;

  return (
    <DistributionPage>
      <DistributionHeader
        title="Inbound"
        titleAccent="logistics"
        description="Supply into your network — plant pickups, ports, cross-docks, and DC receipts. Track every handoff from supplier to put-away."
      />
      <ShipmentBoard companyId={companyId} direction="inbound" titleNoun="Inbound" />
    </DistributionPage>
  );
}
