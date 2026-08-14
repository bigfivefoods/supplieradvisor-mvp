'use client';

import { DentalgraphWorkbench } from '@/components/dental/DentalgraphWorkbench';
import { MedicalAidClaimsDesk } from '@/components/clinic/MedicalAidClaimsDesk';

export default function DentalAidClaimsPage() {
  return (
    <DentalgraphWorkbench
      title="Medical-aid claims"
      titleAccent="submit to scheme"
      description="Draft claims from attended visits, print a claim pack, email it to the scheme, and record paid or rejected."
    >
      <MedicalAidClaimsDesk module="dentalgraph" accent="sky" />
    </DentalgraphWorkbench>
  );
}
