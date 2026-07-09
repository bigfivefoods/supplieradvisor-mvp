'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Employee Directory"
      description="Employee Directory with ratings/reviews."
      backHref="/dashboard/people"
    />
  );
}
