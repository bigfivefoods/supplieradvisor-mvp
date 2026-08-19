'use client';

import { PsychiatrygraphWorkbench } from '@/components/clinic/PsychiatrygraphWorkbench';
import { MedicalAidClaimsDesk } from '@/components/clinic/MedicalAidClaimsDesk';

export default function PsychiatryAidClaimsPage() {
  return (
    <PsychiatrygraphWorkbench
      title="Medical-aid claims"
      titleAccent="submit to scheme"
      description="Draft claims from attended visits, validate PCNS / ICD-10 / tariff, submit to MediKredit (sandbox until accredited), import ERA, and show co-pay on SA Member."
    >
      <MedicalAidClaimsDesk module="psychiatrygraph" accent="indigo" />
    </PsychiatrygraphWorkbench>
  );
}
