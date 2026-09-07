'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APPARELGRAPH_PAGES } from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-2 flex flex-wrap gap-2">
        {APPARELGRAPH_PAGES.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                active
                  ? 'bg-cyan-700 text-white'
                  : 'bg-white text-cyan-900 border border-cyan-200'
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
