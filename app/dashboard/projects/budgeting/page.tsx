'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Budgeting lives in portfolio/programmes — avoid Coming Soon dead-end. */
export default function ProjectBudgetingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/projects/portfolio');
  }, [router]);
  return (
    <div className="py-24 flex flex-col items-center text-sm text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mb-3" />
      Opening portfolio budgets…
    </div>
  );
}
