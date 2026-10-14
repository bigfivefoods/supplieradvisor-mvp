'use client';

import type { ReactNode } from 'react';
import { TradeBookProvider } from '@/components/trades/TradeBook';
import { ClientPwa } from '@/components/trades/ClientPwa';

export function DemoClient({ customerId, balance }: { customerId: string; balance?: ReactNode }) {
  return (
    <TradeBookProvider>
      <ClientPwa customerId={customerId} balance={balance} />
    </TradeBookProvider>
  );
}
