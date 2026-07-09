'use client';

import ComingSoon from '@/components/ComingSoon';

export default function ContainerTrainingPage() {
  return (
    <ComingSoon
      title="Training Hub"
      description="Track contractor onboarding, training completion, certifications, and retail operating standards for every container."
      backHref="/dashboard/containers"
      features={[
        'Training modules and completion tracking',
        'Contractor certification status',
        'Onboarding checklists per container',
      ]}
    />
  );
}
