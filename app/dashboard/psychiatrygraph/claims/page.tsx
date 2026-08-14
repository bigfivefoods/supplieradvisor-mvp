'use client';

import { PsychiatrygraphWorkbench } from '@/components/clinic/PsychiatrygraphWorkbench';
import { MedicalAidClaimsDesk } from '@/components/clinic/MedicalAidClaimsDesk';

export default function PsychiatryAidClaimsPage() {
  return (
    <PsychiatrygraphWorkbench
      title="Medical-aid claims"
      titleAccent="submit to scheme"
      description="Draft claims from attended visits, print a claim pack, email it to the scheme, and record paid or rejected."
    >
      <MedicalAidClaimsDesk module="psychiatrygraph" accent="indigo" />
    </PsychiatrygraphWorkbench>
  );
}
