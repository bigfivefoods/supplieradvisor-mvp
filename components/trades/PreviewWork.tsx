'use client';

import { TradeBookProvider } from '@/components/trades/TradeBook';
import { WorkPwa } from '@/components/trades/WorkPwa';

export function PreviewWork({ role, memberId }: { role: string; memberId: string }) {
  const technician = role === 'technician';
  return (
    <TradeBookProvider>
      <WorkPwa
        role={technician ? 'technician' : 'owner'}
        memberId={memberId || (technician ? 'tm_lerato' : 'tm_amina')}
      />
    </TradeBookProvider>
  );
}
