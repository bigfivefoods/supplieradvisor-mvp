'use client';

import { PhysiographWorkbench } from '@/components/clinic/PhysiographWorkbench';
import { MedicalAidClaimsDesk } from '@/components/clinic/MedicalAidClaimsDesk';

export default function PhysioAidClaimsPage() {
  return (
    <PhysiographWorkbench
      title="Medical-aid claims"
      titleAccent="submit to scheme"
      description="Draft claims from attended visits, print a claim pack, email it to the scheme, and record paid or rejected."
    >
      <MedicalAidClaimsDesk module="physiograph" accent="teal" />
    </PhysiographWorkbench>
  );
}
