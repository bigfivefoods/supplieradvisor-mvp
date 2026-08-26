'use client';

import { VetgraphWorkbench } from '@/components/clinic/VetgraphWorkbench';
import { MedicalAidClaimsDesk } from '@/components/clinic/MedicalAidClaimsDesk';

export default function MedicalAidClaimsPage() {
  return (
    <VetgraphWorkbench
      title="Medical-aid claims"
      titleAccent="submit to scheme"
      description="Draft claims from attended visits, validate PCNS / ICD-10 / tariff, submit to MediKredit (sandbox until accredited), import ERA, and show co-pay on SA Member."
    >
      <MedicalAidClaimsDesk module="vetgraph" accent="emerald" />
    </VetgraphWorkbench>
  );
}
