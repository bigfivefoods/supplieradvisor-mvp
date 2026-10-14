'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TradeBookProvider, useTradeBook } from '@/components/trades/TradeBook';
import { WorkPwa } from '@/components/trades/WorkPwa';

export default function CrewTradePage() {
  const params = useParams<{ token: string }>();
  return (
    <TradeBookProvider>
      <CrewInner token={params.token || ''} />
    </TradeBookProvider>
  );
}

function CrewInner({ token }: { token: string }) {
  const { book, ready } = useTradeBook();
  if (!ready) return <p className="p-6 text-sm">Opening the work app…</p>;
  const member = book.desk.team.find((row) => row.portal_token === token);
  if (!member) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-black">TradeAdvisor® work app</h1>
        <p className="mt-2 text-sm text-slate-600">This link is not on the sample book. Sign in to open your company.</p>
        <Link className="mt-4 inline-block rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-[#0f172a]" href="/work/tradegraph">
          Sign in
        </Link>
      </main>
    );
  }
  return <WorkPwa role={member.role === 'owner' ? 'owner' : 'technician'} memberId={member.id} />;
}
