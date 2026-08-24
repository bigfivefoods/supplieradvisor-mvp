'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <PortfolioInner />
    </Suspense>
  );
}

function PortfolioInner() {
  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="EPM · Portfolio"
        title="All"
        titleAccent="initiatives"
        description="Portfolio is being restored. Refresh in a moment for the full project list and customer portal linking."
      />
      <div className="bg-white border rounded-3xl p-16 text-center text-sm text-neutral-500">
        Portfolio module is restoring after a deploy fix. Please refresh shortly.
      </div>
    </RelationshipPage>
  );
}
