'use client';

import SalesShell from '@/components/sales/SalesShell';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <SalesShell>{children}</SalesShell>;
}
