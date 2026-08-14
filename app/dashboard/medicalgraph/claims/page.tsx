'use client';

import { MedicalgraphWorkbench } from '@/components/clinic/MedicalgraphWorkbench';
import { MedicalAidClaimsDesk } from '@/components/clinic/MedicalAidClaimsDesk';

export default function MedicalAidClaimsPage() {
  return (
    <MedicalgraphWorkbench
      title="Medical-aid claims"
      titleAccent="submit to scheme"
      description="Draft claims from attended visits, print a claim pack, email it to the scheme, and record paid or rejected."
    >
      <MedicalAidClaimsDesk module="medicalgraph" accent="emerald" />
    </MedicalgraphWorkbench>
  );
}
