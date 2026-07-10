'use client';

import { getSelectedCompanyId } from '@/lib/containers/company';
import { ShipmentBoard } from '@/components/distribution/ShipmentBoard';
import {
  CompanyRequired,
  DistributionHeader,
  DistributionPage,
} from '@/components/distribution/DistributionShell';

export default function OutboundPage() {
  return (
    <CompanyRequired>
      <OutboundInner />
    </CompanyRequired>
  );
}

function OutboundInner() {
  const companyId = getSelectedCompanyId()!;

  return (
    <DistributionPage>
      <DistributionHeader
        title="Outbound"
        titleAccent="logistics"
        description="Fulfilment to the world — last-mile vans to ocean containers. Dispatch, track, and prove delivery with event-level POD."
      />
      <ShipmentBoard companyId={companyId} direction="outbound" titleNoun="Outbound" />
    </DistributionPage>
  );
}
