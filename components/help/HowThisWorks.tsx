'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp } from 'lucide-react';
import { guideIdForPath } from '@/lib/help/guide-path';

/** Contextual link on a module screen. Opens that module's how-to. */
export function HowThisWorks() {
  const pathname = usePathname();
  const id = guideIdForPath(pathname);
  if (!id) return null;
  return (
    <div className="mb-4 flex justify-end">
      <Link
        href={`/dashboard/help/${id}`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#00b4d8]/30 bg-white px-3 text-xs font-bold text-[#0077b6] shadow-sm hover:border-[#00b4d8]"
      >
        <CircleHelp className="h-3.5 w-3.5 text-[#00b4d8]" aria-hidden />
        How this works
      </Link>
    </div>
  );
}
