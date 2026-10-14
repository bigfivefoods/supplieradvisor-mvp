import { TradeDeskApp } from '@/components/trades/TradeDeskApp';
import { seedHarbourBook } from '@/lib/trades/harbour-seed';

type Query = Record<string, string | string[] | undefined>;

function one(query: Query, key: string): string {
  const value = query[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function PreviewTradeViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<Query>;
}) {
  const { view } = await params;
  const query = await searchParams;
  const jobId = one(query, 'job');
  const heading = view === 'gantt' ? <GanttHeading jobId={jobId} /> : undefined;
  return (
    <TradeDeskApp
      base="/preview/tradegraph"
      view={view}
      jobId={jobId}
      heading={heading}
      quoteId={one(query, 'quote')}
      invoiceId={one(query, 'invoice')}
      payRef={one(query, 'ref')}
      startNew={one(query, 'new') === '1'}
    />
  );
}

function GanttHeading({ jobId }: { jobId: string }) {
  const book = seedHarbourBook();
  const job = book.store.jobs.find((row) => row.id === jobId) || book.store.jobs.find((row) => row.id === 'tj_waste') || book.store.jobs[0];
  if (!job) return null;
  const customer = book.store.customers.find((row) => row.id === job.customer_id);
  return (
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[#0077b6]">{job.number}</p>
      <h2 className="text-2xl font-black">{job.title}</h2>
      <p className="text-sm text-slate-600">{customer?.name} · {job.address}</p>
      <a className="text-sm font-bold text-[#0077b6]" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">
        Open the site in maps
      </a>
    </header>
  );
}
