'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Bills of Materials"
      description="Define and manage product recipes, components, and version-controlled BOMs."
      backHref="/dashboard/manufacturing"
    />
  );
}
