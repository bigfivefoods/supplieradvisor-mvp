import { TradeDeskApp } from '@/components/trades/TradeDeskApp';

type Query = Record<string, string | string[] | undefined>;

function one(query: Query, key: string): string {
  const value = query[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function TradeViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<Query>;
}) {
  const { view } = await params;
  const query = await searchParams;
  return (
    <TradeDeskApp
      live
      base="/dashboard/tradegraph"
      view={view}
      jobId={one(query, 'job')}
      quoteId={one(query, 'quote')}
      invoiceId={one(query, 'invoice')}
      payRef={one(query, 'ref')}
      startNew={one(query, 'new') === '1'}
    />
  );
}
