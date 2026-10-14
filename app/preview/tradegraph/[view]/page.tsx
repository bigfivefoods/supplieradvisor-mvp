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
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00b4d8]">{job.number}</p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{job.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{customer?.name} · {job.address}</p>
      <a className="mt-2 inline-flex text-sm font-bold text-[#00b4d8]" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">
        Open the site in maps
      </a>
    </header>
  );
}
