'use client';

import {
  HIREGRAPH_PROCESS_GUIDE_LANDSCAPE_HREF,
  HIREGRAPH_PROCESS_GUIDE_PORTRAIT_HREF,
} from '@/lib/hire/hiregraph-process-guide-links';

export default function HiregraphProcessPdfButtons({
  variant = 'map',
}: {
  variant?: 'map' | 'hub';
}) {
  const base =
    variant === 'hub'
      ? 'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-sm transition-colors'
      : 'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-sm transition-colors';

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={HIREGRAPH_PROCESS_GUIDE_LANDSCAPE_HREF}
        className={`${base} bg-white text-violet-900 hover:bg-violet-50 dark:bg-gradient-to-r dark:from-violet-500 dark:to-cyan-400 dark:text-slate-950`}
      >
        Process PDF · landscape
      </a>
      <a
        href={HIREGRAPH_PROCESS_GUIDE_PORTRAIT_HREF}
        className={`${base} border border-violet-200 bg-white/90 text-violet-800 hover:bg-violet-50 dark:border-violet-400/40 dark:bg-violet-950/50 dark:text-violet-100`}
      >
        Portrait
      </a>
    </div>
  );
}
