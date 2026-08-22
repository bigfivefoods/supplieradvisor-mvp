'use client';

import { OnchainProviders } from '@/components/onchain/OnchainProviders';

export default function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnchainProviders>{children}</OnchainProviders>;
}
