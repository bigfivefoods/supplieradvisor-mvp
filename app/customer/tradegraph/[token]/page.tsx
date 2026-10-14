import { notFound } from 'next/navigation';
import { CustomerTradeApp } from '@/components/trades/CustomerTradeApp';
import { isPublicTradeToken } from '@/lib/trades/tradegraph';

type Props = { params: Promise<{ token: string }> };

export default async function CustomerTradePage({ params }: Props) {
  const { token } = await params;
  if (!isPublicTradeToken(token)) notFound();
  return <CustomerTradeApp token={token} />;
}
