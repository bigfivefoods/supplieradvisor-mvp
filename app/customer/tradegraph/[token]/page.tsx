import { notFound } from 'next/navigation';
import { isPublicTradeToken } from '@/lib/trades/tradegraph';

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ as?: string }>;
};

export default async function CustomerTradePage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  if (!isPublicTradeToken(token)) notFound();
  if (token === 'demo') {
    const { DemoClient } = await import('@/components/trades/DemoClient');
    return <DemoClient customerId={query.as || 'tc_naledi'} />;
  }
  const { CustomerTradeApp } = await import('@/components/trades/CustomerTradeApp');
  return <CustomerTradeApp token={token} />;
}
