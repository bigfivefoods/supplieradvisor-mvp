'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TradeDesk, type TradeView } from '@/components/trades/TradeDesk';

const VIEWS: { id: TradeView; label: string }[] = [
  { id: 'command', label: 'Command' },
  { id: 'customers', label: 'Customers' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'materials', label: 'Materials' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'compliance', label: 'Compliance' },
];

function PreviewDesk() {
  const params = useSearchParams();
  const raw = params.get('view') || 'command';
  const view = VIEWS.some((item) => item.id === raw) ? (raw as TradeView) : 'command';
  return (
    <div className="min-h-dvh bg-[#f8fafc]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <p className="mr-2 text-xs font-black uppercase tracking-widest text-[#0077b6]">
            Sample book
          </p>
          {VIEWS.map((item) => (
            <Link
              key={item.id}
              href={item.id === 'command' ? '/preview/tradegraph' : `/preview/tradegraph?view=${item.id}`}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                view === item.id ? 'bg-[#00b4d8] text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <TradeDesk view={view} preview />
    </div>
  );
}

export default function PreviewTradegraphPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Opening the sample book…</main>}>
      <PreviewDesk />
    </Suspense>
  );
}
