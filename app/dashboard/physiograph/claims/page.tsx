'use client';

import { PhysiographWorkbench } from '@/components/clinic/PhysiographWorkbench';
import { MedicalAidClaimsDesk } from '@/components/clinic/MedicalAidClaimsDesk';

export default function PhysioAidClaimsPage() {
  return (
    <PhysiographWorkbench
      title="Medical-aid claims"
      titleAccent="submit to scheme"
      description="Draft claims from attended visits, validate PCNS / ICD-10 / tariff, submit to MediKredit (sandbox until accredited), import ERA, and show co-pay on SA Member."
    >
      <MedicalAidClaimsDesk module="physiograph" accent="teal" />
    </PhysiographWorkbench>
  );
}
