'use client';

import { OnchainProviders } from '@/components/onchain/OnchainProviders';

export default function SupplierPoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnchainProviders>{children}</OnchainProviders>;
}
