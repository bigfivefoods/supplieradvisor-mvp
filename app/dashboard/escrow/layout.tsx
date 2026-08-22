'use client';

import { OnchainProviders } from '@/components/onchain/OnchainProviders';

export default function EscrowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnchainProviders>{children}</OnchainProviders>;
}
