'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Milestones"
      description="Project delivery tooling is expanding. Use My Business projects and Operations for live work today."
      backHref="/dashboard/projects"
      primaryHref="/dashboard/my-business/projects"
      primaryLabel="Open business projects"
    />
  );
}
