'use client';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Kanban Boards"
      description="Kanban Boards with ratings, RIAD, and on-chain records."
      backHref="/dashboard/projects"
    />
  );
}
