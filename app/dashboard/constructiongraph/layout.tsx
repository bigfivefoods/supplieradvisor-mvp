'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CONSTRUCTIONGRAPH_PAGES } from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-300 bg-stone-50/80 p-2 flex flex-wrap gap-2">
        {CONSTRUCTIONGRAPH_PAGES.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                active
                  ? 'bg-stone-800 text-white'
                  : 'bg-white text-stone-900 border border-stone-300'
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
