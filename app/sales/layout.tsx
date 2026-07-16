'use client';

import SalesShell from '@/components/sales/SalesShell';
import SamMessenger from '@/components/sam/SamMessenger';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SalesShell>
      {children}
      <SamMessenger />
    </SalesShell>
  );
}
