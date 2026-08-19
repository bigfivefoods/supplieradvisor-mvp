'use client';

import { DentalgraphWorkbench } from '@/components/dental/DentalgraphWorkbench';
import { MedicalAidClaimsDesk } from '@/components/clinic/MedicalAidClaimsDesk';

export default function DentalAidClaimsPage() {
  return (
    <DentalgraphWorkbench
      title="Medical-aid claims"
      titleAccent="submit to scheme"
      description="Draft claims from attended visits, validate PCNS / ICD-10 / tariff, submit to MediKredit (sandbox until accredited), import ERA, and show co-pay on SA Member."
    >
      <MedicalAidClaimsDesk module="dentalgraph" accent="sky" />
    </DentalgraphWorkbench>
  );
}
