'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { TradeBookProvider } from '@/components/trades/TradeBook';
import { WorkPwa } from '@/components/trades/WorkPwa';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { tradePwaCapabilities } from '@/lib/trades/pwa-roles';

export default function WorkTradePage() {
  const { ready, authenticated, login } = usePrivy();
  const { role, loading } = useCompanyRole();
  if (!ready || loading) {
    return <p className="p-6 text-sm">Opening TradeAdvisor®…</p>;
  }
  if (!authenticated) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-black">TradeAdvisor®</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in with SupplierAdvisor® to open the owner or technician app.</p>
        <button type="button" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" onClick={() => login()}>
          Sign in
        </button>
        <p className="mt-4 text-sm">
          <Link className="font-bold text-[#00b4d8]" href="/preview/tradegraph/work?role=owner">Open the sample owner app</Link>
        </p>
      </main>
    );
  }
  const caps = tradePwaCapabilities(role);
  return (
    <TradeBookProvider live>
      <WorkPwa role={caps.role === 'owner' ? 'owner' : 'technician'} memberId="" />
    </TradeBookProvider>
  );
}
