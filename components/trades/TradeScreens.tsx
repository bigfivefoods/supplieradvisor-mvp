'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BOARD_COLUMNS,
  boardCards,
  lineFromPrice,
  overdueInvoices,
  readGantt,
  sellCents,
  tradeReport,
  voRegister,
  type BoardColumn,
} from '@/lib/trades/desk';
import { formatZar, quoteTotals, type QuoteLine } from '@/lib/trades/tradegraph';
import { GanttChart } from '@/components/trades/GanttChart';
import { useTradeBook } from '@/components/trades/TradeBook';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { HubTelemetryGrid, TelemetryCard } from '@/components/chrome/CommandHubChrome';
import { AlertList, AvatarStack, DayTimeline, JobFaceMeta, MoneyBars, PageHead, StatusPill, bookToday, jobFace, moneyRows, officeAlerts, prettyDay } from '@/components/trades/TradeOffice';
import { CatalogueDownloadButton } from '@/components/catalogues/CatalogueDownloadButton';
import { catalogueForModule } from '@/lib/catalogues';
import { TradeEmpty, TradeHeading, TradeStat, tradeChipOff, tradeChipOn } from '@/components/trades/TradeUi';
import { CalendarDays, FilePenLine, HardHat, Receipt, TrendingUp, Users, Wallet } from 'lucide-react';

const COL: Record<BoardColumn, string> = {
  enquiry: 'Enquiry',
  quoted: 'Quoted',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  done: 'Done',
  invoiced: 'Invoiced',
  paid: 'Paid',
};

const PRIMARY_LINKS = [
  ['', 'Home'],
  ['/board', 'Jobs'],
  ['/quote', 'Quote'],
  ['/gantt', 'Gantt'],
  ['/calendar', 'Calendar'],
  ['/invoices', 'Invoices'],
  ['/customers', 'Customers'],
  ['/materials', 'Materials'],
  ['/team', 'Team'],
  ['/reports', 'Reports'],
] as const;

const MORE_LINKS = [
  ['/tasks', 'Tasks'],
  ['/messages', 'Messages'],
  ['/sites', 'Sites'],
  ['/reviews', 'Reviews'],
  ['/notices', 'Notices'],
  ['/compliance', 'Compliance'],
  ['/arrival', 'Arrival'],
  ['/website', 'Website'],
] as const;

export function TradeNav({ base }: { base: string }) {
  const path = usePathname() || base;
  const chip = (href: string, label: string) => {
    const target = `${base}${href}` || base;
    const on = href === '' ? path === base || path === `${base}/` : path === target || path.startsWith(`${target}/`);
    return (
      <Link
        key={label}
        href={target}
        aria-current={on ? 'page' : undefined}
        className={on ? tradeChipOn : tradeChipOff}
      >
        {label}
      </Link>
    );
  };
  return (
    <nav className="mb-5 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="TradeAdvisor®">
      <div className="flex flex-wrap gap-1.5">
        {PRIMARY_LINKS.map(([href, label]) => chip(href, label))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-1.5" aria-label="More TradeAdvisor®">
        {MORE_LINKS.map(([href, label]) => chip(href, label))}
      </div>
    </nav>
  );
}

export function TradeCommand({ base }: { base: string }) {
  const { book } = useTradeBook();
  const report = tradeReport(book);
  const cards = boardCards(book);
  const today = bookToday(book.store.settings.public_token);
  const slots = book.store.schedule.filter((slot) => slot.starts_at.slice(0, 10) === today);
  const onTools = cards.filter((row) => row.column === 'in_progress').length;
  const liveJobs = book.store.jobs.filter((row) => row.status !== 'cancelled').length;
  const workHref = base.startsWith('/preview') ? '/preview/tradegraph/work?role=owner' : '/work/tradegraph';
  const previewColumns = BOARD_COLUMNS.filter((column) => ['enquiry', 'quoted', 'scheduled', 'in_progress'].includes(column));
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl bg-[#00b4d8] text-[#0f172a] shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f172a]/70">Office · {prettyDay(today)}</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{book.store.settings.brand_name}</h2>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]/80">
              {book.store.settings.city} · {book.store.settings.phone} · {liveJobs} jobs on the book
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/board?new=1`} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-[#0f172a] shadow-sm" data-testid="new-job-link">
              New job
            </Link>
            <Link href={`${base}/quote`} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0f172a]/10 px-4 text-sm font-black text-[#0f172a]">
              New quote
            </Link>
            <Link href={workHref} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0f172a]/10 px-4 text-sm font-black text-[#0f172a]">
              Work app
            </Link>
            <Link href="/customer/tradegraph/demo" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0f172a]/10 px-4 text-sm font-black text-[#0f172a]">
              Customer app
            </Link>
            <CatalogueDownloadButton id={catalogueForModule('tradegraph')?.id} variant="quiet" tone="cyan" />
          </div>
        </div>
      </section>
      <HubTelemetryGrid className="mb-0">
        <TelemetryCard label="Customers" value={book.store.customers.length} sub={`${book.desk.sites.length} sites on file`} accent="cyan" icon={Users} href={`${base}/customers`} />
        <TelemetryCard label="On the tools" value={onTools} sub={`${onTools} of ${liveJobs} jobs in progress`} accent="emerald" icon={HardHat} href={`${base}/board`} />
        <TelemetryCard label="Outstanding" value={formatZar(report.outstanding_cents)} sub={`${overdueInvoices(book, today).length} overdue`} accent="amber" icon={Receipt} href={`${base}/invoices`} />
        <TelemetryCard label="Win rate" value={`${Math.round(report.win_rate * 100)}%`} sub={`${report.won} of ${report.decided} quotes decided`} accent="violet" icon={TrendingUp} href={`${base}/reports`} />
        <TelemetryCard label="Received" value={formatZar(report.revenue_cents)} sub="Payments on this book" accent="sky" icon={Wallet} href={`${base}/reports`} />
        <TelemetryCard label="Today" value={slots.length} sub={prettyDay(today)} accent="slate" icon={CalendarDays} href={`${base}/calendar`} />
      </HubTelemetryGrid>
      <div className="grid gap-4 xl:grid-cols-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-3">
          <TradeHeading hint={prettyDay(today)}>Today’s schedule</TradeHeading>
          <div className="mt-4">
            <DayTimeline book={book} slots={slots} />
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-2">
          <TradeHeading hint="Overdue money, unsigned quotes, certificates, and tasks.">Next actions</TradeHeading>
          <div className="mt-4">
            <AlertList items={officeAlerts(book, today, base)} />
          </div>
        </section>
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <TradeHeading hint="Enquiry through the tools. Open the board for the full pipeline.">Pipeline</TradeHeading>
            <Link href={`${base}/board`} className="text-xs font-black text-[#00b4d8]">Open board</Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {previewColumns.map((column) => {
              const rows = cards.filter((card) => card.column === column).slice(0, 2);
              return (
                <div key={column} className="rounded-2xl bg-slate-50 p-2">
                  <p className="px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {COL[column]} · {cards.filter((card) => card.column === column).length}
                  </p>
                  <ul className="mt-1 space-y-1.5">
                    {rows.map((card) => (
                      <li key={card.id} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs">
                        <p className="font-black text-slate-900">{card.title}</p>
                        <p className="truncate text-slate-500">{card.subtitle}</p>
                      </li>
                    ))}
                    {!rows.length ? <li className="px-1 py-3 text-center text-[11px] text-slate-400">Empty</li> : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-2">
          <TradeHeading hint="Invoice totals on the book, largest first.">Money</TradeHeading>
          <div className="mt-4">
            <MoneyBars rows={moneyRows(book)} />
          </div>
          <Link href={`${base}/reports`} className="mt-4 inline-flex text-xs font-black text-[#00b4d8]">Open reports</Link>
        </section>
      </div>
      <section>
        <TradeHeading hint="Status, customer, site, time, who is on it, and the value.">Live jobs</TradeHeading>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {book.store.jobs.filter((job) => job.status === 'in_progress' || job.status === 'scheduled').map((job) => {
            const face = jobFace(book, job.id);
            return (
              <Link key={job.id} href={`${base}/gantt?job=${job.id}`} className="block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#00b4d8]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">{job.number}</p>
                    <p className="mt-0.5 font-black text-slate-900">{job.title}</p>
                  </div>
                  <StatusPill status={job.status} />
                </div>
                <JobFaceMeta book={book} jobId={job.id} />
                {face ? (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#00b4d8]" style={{ width: `${Math.max(4, face.job.progress_pct)}%` }} />
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function TradeBoard({ base, startNew = false }: { base: string; startNew?: boolean }) {
  const { book, dispatch } = useTradeBook();
  const [open, setOpen] = useState(startNew);
  const cards = boardCards(book);
  return (
    <div className="space-y-4">
      <PageHead kicker="Floor" title="Jobs" detail="Drag is on the Gantt. Open a card to move the job.">
        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" data-testid="new-job" onClick={() => setOpen(true)}>
          New job
        </button>
      </PageHead>
      {open ? <NewJobForm onClose={() => setOpen(false)} /> : null}
      <div className="flex gap-3 overflow-x-auto pb-2" data-testid="job-board">
        {BOARD_COLUMNS.map((column) => (
          <section key={column} className="w-72 shrink-0 rounded-3xl border border-slate-200 bg-slate-50 p-2 shadow-sm lg:w-auto lg:min-w-[220px] lg:flex-1" data-testid={`column-${column}`}>
            <h3 className="flex items-center justify-between px-2 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-600">
              <span>{COL[column]}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-700">{cards.filter((card) => card.column === column).length}</span>
            </h3>
            <ul className="space-y-2">
              {cards.filter((card) => card.column === column).map((card) => (
                <li key={card.id}>
                  {card.kind === 'job' ? (
                    <Link href={`${base}/gantt?job=${card.ref_id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition hover:border-[#00b4d8]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-slate-900">{card.title}</p>
                        <StatusPill status={column} />
                      </div>
                      <JobFaceMeta book={book} jobId={card.ref_id} />
                    </Link>
                  ) : card.kind === 'request' ? (
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm shadow-sm"
                      onClick={() => {
                        const request = book.store.requests.find((row) => row.id === card.ref_id);
                        if (!request) return;
                        dispatch({
                          type: 'create_job',
                          customer_id: request.customer_id,
                          title: request.description.slice(0, 80),
                          address: request.address,
                          notes: request.preferred_dates,
                          request_id: request.id,
                        });
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-slate-900">{card.title}</p>
                        <StatusPill status="enquiry" />
                      </div>
                      <p className="mt-1 text-slate-600">{card.subtitle}</p>
                      <p className="mt-2 text-xs font-black text-[#00b4d8]">Make this a job</p>
                    </button>
                  ) : (
                    <Link href={`${base}/quote?quote=${card.ref_id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-slate-900">{card.title}</p>
                        <StatusPill status="quoted" />
                      </div>
                      <p className="mt-1 text-slate-600">{card.subtitle}</p>
                      {card.money ? <p className="mt-2 text-sm font-black tabular-nums">{formatZar(Number(card.money))}</p> : null}
                    </Link>
                  )}
                </li>
              ))}
              {!cards.some((card) => card.column === column) ? (
                <li className="rounded-2xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">Nothing here</li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function NewJobForm({ onClose }: { onClose: () => void }) {
  const { book, dispatch } = useTradeBook();
  const [customerId, setCustomerId] = useState(book.store.customers[0]?.id || '');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  return (
    <form
      className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="new-job-form"
      onSubmit={(event) => {
        event.preventDefault();
        dispatch({ type: 'create_job', customer_id: customerId, title, address });
        onClose();
      }}
    >
      <h3 className="font-black">New job</h3>
      <label className="mt-3 block text-sm font-semibold">
        Customer
        <select className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" data-testid="job-customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          {book.store.customers.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Title
        <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" data-testid="job-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Site address
        <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" data-testid="job-save">Save job</button>
        <button type="button" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export function TradeQuoteBuilder({ presetCustomer = '', base = '/preview/tradegraph' }: { presetCustomer?: string; base?: string }) {
  const { book, dispatch } = useTradeBook();
  const [customerId, setCustomerId] = useState(presetCustomer || book.store.customers[0]?.id || '');
  const [title, setTitle] = useState('Quote');
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [optional, setOptional] = useState<string[]>([]);
  const [deposit, setDeposit] = useState(30);
  const [jobId, setJobId] = useState('');
  const totals = quoteTotals(lines, book.store.settings.vat_rate);
  const sent = book.store.quotes.filter((row) => row.status === 'sent').length;
  const drafts = book.store.quotes.filter((row) => row.status === 'draft').length;
  const accepted = book.store.quotes.filter((row) => row.status === 'accepted').length;
  return (
    <div className="space-y-4">
      <PageHead kicker="Floor" title="Quote" detail="Lines come from the price book. VAT is 15% on top." />
      <HubTelemetryGrid className="mb-0">
        <TelemetryCard label="Drafts" value={drafts} sub="Not sent yet" accent="slate" icon={FilePenLine} />
        <TelemetryCard label="Waiting" value={sent} sub="Sent for signature" accent="sky" icon={Receipt} />
        <TelemetryCard label="Accepted" value={accepted} sub="Won on this book" accent="emerald" icon={TrendingUp} />
      </HubTelemetryGrid>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        data-testid="quote-builder"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({
            type: 'create_quote',
            customer_id: customerId,
            title,
            lines,
            deposit_pct: deposit,
            job_id: jobId || null,
            options: optional.length ? [{ id: 'opt_extra', name: 'Optional extras', line_ids: optional }] : [],
          });
        }}
      >
        <h3 className="text-lg font-black tracking-tight text-slate-900">New draft</h3>
        <label className="mt-3 block text-sm font-semibold">
          Customer
          <select className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" data-testid="quote-customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            {book.store.customers.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Link to a job
          <select className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" data-testid="quote-job" value={jobId} onChange={(event) => setJobId(event.target.value)}>
            <option value="">No job yet</option>
            {book.store.jobs.filter((row) => row.customer_id === customerId).map((row) => (
              <option key={row.id} value={row.id}>{row.number} · {row.title}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Title
          <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" data-testid="quote-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {book.desk.templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold"
              onClick={() => {
                setTitle(template.title);
                setDeposit(template.deposit_pct);
                setLines(template.lines.map((row) => ({ ...row, id: `${row.id}_${template.id}` })));
              }}
            >
              Template: {template.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {book.desk.price_book.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`price-${item.id}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold"
              onClick={() => setLines((current) => [...current, lineFromPrice(item, 1)])}
            >
              {item.name} · {formatZar(sellCents(item))}
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
              <span className="min-w-40 flex-1 font-semibold">{line.description}{optional.includes(line.id) ? ' · option' : ''}</span>
              <input
                className="w-16 rounded-lg border border-slate-200 px-2 py-1"
                type="number"
                min={1}
                aria-label={`Quantity for ${line.description}`}
                value={line.qty}
                onChange={(event) =>
                  setLines((current) => current.map((row) => (row.id === line.id ? { ...row, qty: Number(event.target.value) } : row)))
                }
              />
              <button
                type="button"
                className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold"
                onClick={() =>
                  setOptional((current) =>
                    current.includes(line.id) ? current.filter((id) => id !== line.id) : [...current, line.id]
                  )
                }
              >
                {optional.includes(line.id) ? 'Included' : 'Make optional'}
              </button>
              <span className="w-24 shrink-0 text-right font-semibold">{formatZar(Math.round(line.qty * line.unit_cents))}</span>
            </li>
          ))}
          {!lines.length ? <li className="text-sm text-slate-600">Add a labour rate, a material, or a call-out.</li> : null}
        </ul>
        <label className="mt-3 block text-sm font-semibold">
          Deposit %
          <input className="mt-1 w-24 min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" type="number" min={0} max={100} value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} />
        </label>
        <p className="mt-3 text-sm">
          {formatZar(totals.subtotal_cents)} ex VAT · VAT {formatZar(totals.vat_cents)} · <strong>{formatZar(totals.total_cents)} incl VAT</strong>
        </p>
        <button type="submit" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" data-testid="quote-save">
          Save draft
        </button>
      </form>
      <aside className="space-y-2">
        {book.store.quotes.slice(0, 8).map((quote) => {
          const money = quoteTotals(quote.lines, book.store.settings.vat_rate);
          return (
            <article key={quote.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-black text-slate-900">{quote.number}</p>
                <StatusPill status={quote.status} />
              </div>
              <p className="mt-1 font-bold text-slate-800">{quote.title}</p>
              <p className="text-slate-600">{book.store.customers.find((row) => row.id === quote.customer_id)?.name}</p>
              <p className="mt-2 text-lg font-black tabular-nums">{formatZar(money.total_cents)}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">incl VAT</p>
              {quote.status === 'draft' ? (
                <button type="button" className="mt-2 inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" data-testid={`send-${quote.id}`} onClick={() => dispatch({ type: 'send_quote', quote_id: quote.id })}>
                  Send to customer
                </button>
              ) : null}
              {quote.status === 'sent' || quote.status === 'draft' ? (
                <button
                  type="button"
                  className="mt-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold"
                  data-testid={`convert-${quote.id}`}
                  onClick={() => dispatch({ type: 'convert_quote', quote_id: quote.id, name: book.desk.team[0]?.name || 'Owner' })}
                >
                  Accept and invoice
                </button>
              ) : null}
              <Link href={`${base}/quote-sheet?quote=${quote.id}`} className="mt-2 block text-xs font-bold text-[#00b4d8]">
                Quote sheet
              </Link>
            </article>
          );
        })}
      </aside>
    </div>
    </div>
  );
}

export function TradeGantt({ jobId, heading }: { jobId?: string; heading?: ReactNode }) {
  const { book, dispatch } = useTradeBook();
  const job = book.store.jobs.find((row) => row.id === jobId) || book.store.jobs.find((row) => row.id === 'tj_waste') || book.store.jobs[0];
  const programme = job ? book.desk.programmes.find((row) => row.job_id === job.id) : null;
  const [reason, setReason] = useState('');
  const [voTitle, setVoTitle] = useState('');
  const [voScope, setVoScope] = useState('');
  const [voCost, setVoCost] = useState(450);
  const [voDays, setVoDays] = useState(1);
  if (!job || !programme) {
    return <p className="text-sm text-slate-600">Pick a job from the board.</p>;
  }
  const register = voRegister(book, job.id, book.store.settings.vat_rate);
  const customer = book.store.customers.find((row) => row.id === job.customer_id);
  const face = jobFace(book, job.id);
  return (
    <div className="space-y-4">
      {heading ?? (
        <PageHead kicker={job.number} title={job.title} detail={`${customer?.name || 'Customer'} · ${job.address}`}>
          <StatusPill status={job.status} />
          <a className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">
            Open in maps
          </a>
        </PageHead>
      )}
      {face ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Progress</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{face.job.progress_pct}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#00b4d8]" style={{ width: `${Math.max(4, face.job.progress_pct)}%` }} />
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">On the job</p>
            <div className="mt-2"><AvatarStack people={face.techs} /></div>
            <p className="mt-2 text-sm font-bold text-slate-700">{face.techs.map((member) => member.name.split(' ')[0]).join(', ') || 'Unassigned'}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Revised incl VAT</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{formatZar(register.revised_incl_cents)}</p>
            <p className="text-xs text-slate-500">{register.orders.length} variation{register.orders.length === 1 ? '' : 's'}</p>
          </div>
        </div>
      ) : null}
      <GanttChart
        tasks={programme.tasks}
        members={book.desk.team}
        onShift={(taskId, days) => dispatch({ type: 'shift_task', job_id: job.id, task_id: taskId, days })}
      />
      <form
        className="flex flex-wrap items-end gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: 'rebaseline', job_id: job.id, reason });
          setReason('');
        }}
      >
        <label className="text-sm font-semibold">
          Re-baseline
          <input className="mt-1 block min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" data-testid="rebaseline-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why the plan changed" />
        </label>
        <button type="submit" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold">Lock a new plan</button>
        {programme.history.length ? <p className="text-xs text-slate-500">{programme.history.length} earlier baseline{programme.history.length === 1 ? '' : 's'} kept.</p> : null}
      </form>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="vo-register">
        <TradeHeading hint="Original contract plus approved variations.">Variation orders</TradeHeading>
        <p className="mt-2 text-sm">
          Original {formatZar(register.original_cents)} · Approved VOs {formatZar(register.approved_cents)} · <strong>Revised {formatZar(register.revised_cents)} ex VAT</strong> · {formatZar(register.revised_incl_cents)} incl VAT
        </p>
        <ul className="mt-3 space-y-2">
          {register.orders.map((vo) => (
            <li key={vo.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
              <p className="font-bold">{vo.number} · {vo.title} · {vo.status}</p>
              <p>{formatZar(vo.cost_cents)} ex VAT · {vo.days} day{vo.days === 1 ? '' : 's'}</p>
              {vo.status === 'draft' ? (
                <button type="button" className="mt-1 inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" onClick={() => dispatch({ type: 'send_vo', vo_id: vo.id })}>
                  Send for signature
                </button>
              ) : null}
            </li>
          ))}
          {!register.orders.length ? <li className="text-sm text-slate-500">No variations on this job.</li> : null}
        </ul>
        <form
          className="mt-4 grid gap-2 md:grid-cols-2"
          data-testid="vo-form"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({
              type: 'create_vo',
              job_id: job.id,
              title: voTitle,
              scope: voScope,
              cost_cents: Math.round(voCost * 100),
              days: voDays,
            });
            setVoTitle('');
            setVoScope('');
          }}
        >
          <input className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30 text-sm" data-testid="vo-title" placeholder="Variation title" value={voTitle} onChange={(event) => setVoTitle(event.target.value)} required />
          <input className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30 text-sm" data-testid="vo-scope" placeholder="Scope change" value={voScope} onChange={(event) => setVoScope(event.target.value)} required />
          <label className="text-xs font-bold">
            Cost in rands, ex VAT
            <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30 text-sm" type="number" min={0} value={voCost} onChange={(event) => setVoCost(Number(event.target.value))} />
          </label>
          <label className="text-xs font-bold">
            Extra days
            <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30 text-sm" type="number" min={0} value={voDays} onChange={(event) => setVoDays(Number(event.target.value))} />
          </label>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99] md:col-span-2" data-testid="vo-save">
            Save variation
          </button>
        </form>
      </section>
      <JobFold jobId={job.id} />
    </div>
  );
}

function JobFold({ jobId }: { jobId: string }) {
  const { book, dispatch } = useTradeBook();
  const job = book.store.jobs.find((row) => row.id === jobId);
  const programme = book.desk.programmes.find((row) => row.job_id === jobId);
  const [note, setNote] = useState('');
  const [internal, setInternal] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [started, setStarted] = useState<number | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  if (!job || !programme) return null;
  const gantt = readGantt(programme.tasks);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-black">Notes and checklist</h3>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({ type: 'add_note', job_id: job.id, note, shared: !internal });
            setNote('');
          }}
        >
          <input className="flex-1 min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder={internal ? 'Internal note' : 'Note for the customer'} />
          <label className="flex items-center gap-1 text-xs font-bold">
            <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
            Internal only
          </label>
          <button className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" type="submit">{internal ? 'Save' : 'Share'}</button>
        </form>
        <ul className="mt-3 space-y-1 text-sm">
          {programme.checklist.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={item.done} onChange={() => dispatch({ type: 'toggle_checklist', job_id: job.id, item_id: item.id })} />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            dispatch({ type: 'add_checklist', job_id: job.id, label: String(data.get('label') || '') });
            event.currentTarget.reset();
          }}
        >
          <input name="label" className="flex-1 min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30 text-sm" placeholder="Add a check" required />
          <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold" type="submit">Add</button>
        </form>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-black">Photos, time, materials</h3>
        {photosOpen ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {programme.photos.map((photo) => (
              <figure key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption} width={320} height={112} loading="lazy" decoding="async" className="h-28 w-full rounded-2xl object-cover" />
                <figcaption className="text-[11px] text-slate-600">{photo.phase} · {photo.caption}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <button type="button" className="mt-2 text-sm font-bold text-[#00b4d8]" onClick={() => setPhotosOpen(true)}>
            Show {programme.photos.length} site photos
          </button>
        )}
        <label className="mt-2 block text-xs font-bold">
          Camera photo
          <input
            className="mt-1 block w-full text-sm"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const url = String(reader.result || '');
                dispatch({ type: 'add_photo', job_id: job.id, phase: 'during', url, caption: file.name, shared: !internal });
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
            data-testid="time-clock"
            onClick={() => {
              if (started) {
                const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
                dispatch({
                  type: 'add_time',
                  job_id: job.id,
                  member_id: programme.assignees[0] || book.desk.team[0]?.id || '',
                  minutes: mins,
                  note: 'Clocked on site',
                });
                setStarted(null);
              } else {
                setStarted(Date.now());
              }
            }}
          >
            {started ? 'Stop clock' : 'Start clock'}
          </button>
          <label className="text-xs font-bold">
            Minutes
            <input className="ml-2 w-16 rounded-lg border border-slate-200 px-2 py-1" type="number" min={1} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
          </label>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold"
            onClick={() =>
              dispatch({
                type: 'add_time',
                job_id: job.id,
                member_id: programme.assignees[0] || book.desk.team[1]?.id || '',
                minutes,
                note: 'Logged time',
              })
            }
          >
            Log time
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {programme.time_entries.reduce((sum, row) => sum + row.minutes, 0)} minutes on this job.
          {gantt.current ? ` Current phase ${gantt.current.name}.` : ''}
        </p>
        <ul className="mt-2 text-sm">
          {programme.materials_used.map((row) => (
            <li key={row.id}>{row.qty} × {row.description}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {book.desk.team.map((member) => (
            <button key={member.id} type="button" className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold" onClick={() => dispatch({ type: 'assign', job_id: job.id, member_id: member.id })}>
              {programme.assignees.includes(member.id) ? 'On job · ' : 'Assign '}{member.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" data-testid="invoice-final" onClick={() => dispatch({ type: 'create_invoice', job_id: job.id, kind: 'final' })}>
            Invoice the balance
          </button>
          <button type="button" className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold" onClick={() => dispatch({ type: 'create_invoice', job_id: job.id, kind: 'progress', percent: 40 })}>
            Progress invoice 40%
          </button>
        </div>
      </section>
    </div>
  );
}

export function TradeInvoices() {
  const { book, dispatch } = useTradeBook();
  const late = overdueInvoices(book, '2026-10-14');
  const outstanding = book.store.invoices
    .filter((row) => row.status !== 'void' && row.status !== 'paid')
    .reduce((sum, row) => sum + row.total_cents, 0);
  return (
    <div className="space-y-4">
      <PageHead kicker="Money" title="Invoices" detail="Deposits, progress bills, and Paystack links." />
      <HubTelemetryGrid className="mb-0">
        <TelemetryCard label="On the book" value={book.store.invoices.length} sub="Including paid" accent="slate" icon={Receipt} />
        <TelemetryCard label="Overdue" value={late.length} sub="Issued and past due" accent="amber" icon={TrendingUp} />
        <TelemetryCard label="Open" value={formatZar(outstanding)} sub="Not void and not paid" accent="cyan" icon={Wallet} />
      </HubTelemetryGrid>
      {late.length ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-black text-amber-950">{late.length} overdue</p>
          <ul className="mt-2 space-y-2 text-sm">
            {late.map((row) => (
              <li key={row.invoice.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{row.invoice.number} · {row.days} days · {formatZar(row.balance_cents)}</span>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
                  onClick={() => {
                    const customer = book.store.customers.find((item) => item.id === row.invoice.customer_id);
                    dispatch({
                      type: 'message',
                      customer_id: row.invoice.customer_id,
                      from: 'desk',
                      body: `Reminder: ${row.invoice.number} for ${formatZar(row.balance_cents)} is overdue.`,
                    });
                    void customer;
                  }}
                >
                  Send reminder
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-600 shadow-sm">No overdue invoices.</p>
      )}
      <ul className="space-y-2">
        {book.store.invoices.map((invoice) => {
          const meta = book.desk.invoice_meta.find((row) => row.invoice_id === invoice.id);
          return (
            <li key={invoice.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">{meta?.kind || 'final'}</p>
                  <p className="mt-0.5 font-black text-slate-900">{invoice.number}</p>
                  <p className="text-slate-600">{book.store.customers.find((row) => row.id === invoice.customer_id)?.name}</p>
                </div>
                <div className="text-right">
                  <StatusPill status={invoice.status} />
                  <p className="mt-2 text-lg font-black tabular-nums">{formatZar(invoice.total_cents)}</p>
                </div>
              </div>
              {invoice.status !== 'paid' && invoice.status !== 'void' ? (
                <button
                  type="button"
                  className="mt-2 inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
                  data-testid={`pay-link-${invoice.id}`}
                  onClick={() => dispatch({ type: 'pay_link', invoice_id: invoice.id })}
                >
                  Paystack pay link
                </button>
              ) : null}
              {meta?.pay_url ? (
                <a className="mt-2 block text-xs font-bold text-[#00b4d8]" href={meta.pay_url} data-testid={`pay-url-${invoice.id}`}>
                  {meta.pay_reference}
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TradeCalendar() {
  const { book, dispatch, live, icsToken } = useTradeBook();
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week');
  const anchor = '2026-10-14';
  const days = mode === 'day' ? [anchor] : mode === 'week' ? Array.from({ length: 7 }, (_, i) => shift(anchor, i - 3)) : Array.from({ length: 14 }, (_, i) => shift(anchor, i));
  const lanes = book.desk.team;
  const sample =
    !live || book.store.settings.public_token === 'tg_harbour' || book.store.settings.public_token === 'demo';
  const subscribeHref = sample
    ? '/api/public/tradegraph/ics?token=demo'
    : icsToken
      ? `/api/public/tradegraph/ics?ics=${encodeURIComponent(icsToken)}`
      : '';
  const todaySlots = book.store.schedule.filter((slot) => slot.starts_at.slice(0, 10) === anchor);
  return (
    <div className="space-y-4">
      <PageHead kicker="Floor" title="Calendar" detail={`${prettyDay(anchor)} · tap a visit to move it one day later.`}>
        {(['day', 'week', 'month'] as const).map((item) => (
          <button key={item} type="button" className={`min-h-10 rounded-2xl px-3 text-xs font-black capitalize ${mode === item ? 'bg-[#00b4d8] text-[#0f172a] shadow-sm' : 'border border-slate-200 bg-white text-slate-700 shadow-sm'}`} onClick={() => setMode(item)}>
            {item}
          </button>
        ))}
        {subscribeHref ? (
          <a className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm" href={subscribeHref}>
            {sample ? 'Download ICS' : 'Subscribe to calendar'}
          </a>
        ) : null}
      </PageHead>
      <HubTelemetryGrid className="mb-0">
        <TelemetryCard label="Today" value={todaySlots.length} sub={anchor} accent="cyan" icon={CalendarDays} />
        <TelemetryCard label="On the board" value={book.store.schedule.length} sub="All visits" accent="slate" icon={CalendarDays} />
        <TelemetryCard label="Team" value={lanes.length} sub="People with a lane" accent="emerald" icon={Users} />
      </HubTelemetryGrid>
      <div className="space-y-3">
        {lanes.map((member) => (
          <section key={member.id} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <AvatarStack people={[member]} />
              <span>
                {member.name}
                <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{member.trade}</span>
              </span>
            </h3>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {days.map((day) => {
                const slots = book.store.schedule.filter((slot) => slot.starts_at.slice(0, 10) === day);
                const mine = slots.filter((slot) => {
                  const job = book.store.jobs.find((row) => row.id === slot.job_id);
                  const programme = job ? book.desk.programmes.find((row) => row.job_id === job.id) : null;
                  return programme ? programme.assignees.includes(member.id) : member.role === 'owner';
                });
                return (
                  <div key={day} className={`w-40 shrink-0 rounded-2xl p-2 ${day === anchor ? 'bg-cyan-50 ring-1 ring-[#00b4d8]/40' : 'bg-slate-50'}`}>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{day.slice(5)}{day === anchor ? ' · today' : ''}</p>
                    {mine.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className="mt-1 w-full rounded-xl bg-[#00b4d8] px-2 py-1 text-left text-[11px] font-bold text-[#0f172a]"
                        onClick={() => {
                          const next = shift(day, 1);
                          dispatch({
                            type: 'reschedule',
                            slot_id: slot.id,
                            starts_at: slot.starts_at.replace(day, next),
                            ends_at: slot.ends_at.replace(day, next),
                          });
                        }}
                      >
                        {slot.starts_at.slice(11, 16)} {slot.title}
                      </button>
                    ))}
                    {!mine.length ? <p className="mt-2 text-[11px] text-slate-600">Free</p> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-black">Booking requests</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {book.desk.bookings.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{row.note} · {row.status}</span>
              {row.status === 'requested' ? (
                <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" onClick={() => dispatch({ type: 'confirm_booking', booking_id: row.id })}>
                  Confirm
                </button>
              ) : null}
            </li>
          ))}
          {!book.desk.bookings.length ? <li className="text-slate-600">No requests yet. Customers book from their app.</li> : null}
        </ul>
      </section>
    </div>
  );
}

function shift(day: string, delta: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
}

export function TradeReports() {
  const { book } = useTradeBook();
  const report = tradeReport(book);
  const rows = report.jobs.filter((row) => row.revenue_cents || row.cost_cents);
  const max = Math.max(...rows.map((row) => Math.abs(row.profit_cents)), 1);
  return (
    <div className="space-y-4">
      <PageHead kicker="Money" title="Reports" detail="Received cash, what is still open, and profit on each job." />
      <HubTelemetryGrid className="mb-0">
        <TelemetryCard label="Received" value={formatZar(report.revenue_cents)} sub="Payments posted" accent="emerald" icon={Wallet} />
        <TelemetryCard label="Outstanding" value={formatZar(report.outstanding_cents)} sub="Invoices minus payments" accent="amber" icon={Receipt} />
        <TelemetryCard label="Win rate" value={`${Math.round(report.win_rate * 100)}%`} sub={`${report.won} of ${report.decided} decided`} accent="violet" icon={TrendingUp} />
        <TelemetryCard label="Jobs with cost" value={rows.length} sub="Revenue or cost recorded" accent="slate" icon={HardHat} />
      </HubTelemetryGrid>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <TradeHeading hint="Profit is received revenue minus materials, orders, and logged time.">Job profit</TradeHeading>
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-black text-slate-900">{row.number} · {row.title}</p>
                <p className={`text-sm font-black tabular-nums ${row.profit_cents < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{formatZar(row.profit_cents)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-600">Revenue {formatZar(row.revenue_cents)} · Cost {formatZar(row.cost_cents)}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className={`h-full rounded-full ${row.profit_cents < 0 ? 'bg-rose-400' : 'bg-[#00b4d8]'}`} style={{ width: `${Math.max(6, Math.round((Math.abs(row.profit_cents) / max) * 100))}%` }} />
              </div>
            </li>
          ))}
          {!rows.length ? <li><TradeEmpty title="No job costs yet" hint="Log time and materials on a job to see profit." /></li> : null}
        </ul>
      </section>
    </div>
  );
}

export function TradeCustomers() {
  const { book, dispatch } = useTradeBook();
  const [name, setName] = useState('');
  return (
    <div className="space-y-4">
      <PageHead kicker="People" title="Customers" detail="Sites, phones, and the link into the company customer book." />
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <form
        className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({
            type: 'save_customer',
            customer: { id: '', name, email: '', phone: '', address: '', suburb: '', city: 'Cape Town' },
          });
          setName('');
        }}
      >
        <h2 className="font-black">Add a customer</h2>
        <input className="mt-3 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" required />
        <button className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" type="submit">Save</button>
      </form>
      <ul className="grid gap-3 sm:grid-cols-2">
        {book.store.customers.map((customer) => {
          const sites = book.desk.sites.filter((row) => row.customer_id === customer.id);
          const link = book.desk.customer_links.find((row) => row.customer_id === customer.id);
          const jobs = book.store.jobs.filter((row) => row.customer_id === customer.id);
          return (
            <li key={customer.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
              <div className="flex items-start gap-3">
                <AvatarStack people={[{ name: customer.name, colour: '#00b4d8' }]} />
                <div className="min-w-0">
                  <p className="font-black text-slate-900">{customer.name}</p>
                  <p className="text-slate-600">{customer.suburb || customer.city}</p>
                </div>
              </div>
              <p className="mt-3 text-slate-700">{customer.address}{customer.suburb ? `, ${customer.suburb}` : ''}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{jobs.length} job{jobs.length === 1 ? '' : 's'} · {sites.length} site{sites.length === 1 ? '' : 's'}</p>
              {customer.phone ? <p className="mt-1 text-slate-600">{customer.phone}</p> : null}
              {sites.map((site) => (
                <p key={site.id} className="text-slate-600">{site.label}: {site.address}</p>
              ))}
              <Link className="mt-2 inline-block font-bold text-[#00b4d8]" href={link?.connection_id ? `/dashboard/customers/${link.connection_id}` : '/dashboard/customers'}>
                Open in Customers
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
}

export function TradeMaterials() {
  const { book, dispatch, live, reload } = useTradeBook();
  return (
    <div className="space-y-4">
      <PageHead kicker="Yard" title="Materials" detail="Harbour catalogue on the sample book. Signed-in books can pull SupplierAdvisor® products." />
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-black">Price book</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {book.desk.price_book.map((item) => (
            <li key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-black text-slate-900">{item.name}</p>
                <StatusPill status={item.kind} />
              </div>
              <p className="mt-2 text-lg font-black tabular-nums">{formatZar(sellCents(item))}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{item.unit} · {item.sku}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">Signed-in books can pull SupplierAdvisor® products. This sample is the Harbour catalogue.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {live ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold"
              onClick={() => {
                const companyId = getSelectedCompanyId();
                if (!companyId) return;
                void fetch('/api/trades/tradegraph', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ companyId, action: 'import_products' }),
                }).then(() => reload());
              }}
            >
              Import from inventory
            </button>
          ) : null}
          <Link href="/dashboard/inventory/products" className="self-center text-sm font-bold text-[#00b4d8]">Open inventory</Link>
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-black">Supplier orders</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {book.store.materials.map((order) => (
            <li key={order.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-black text-slate-900">{order.supplier_name}</p>
                <StatusPill status={order.status} />
              </div>
              <p className="mt-1 text-slate-600">{order.lines.map((line) => `${line.qty} × ${line.description}`).join(', ')}</p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
          onClick={() =>
            dispatch({
              type: 'order_materials',
              supplier_name: 'Plumblink Claremont',
              job_id: 'tj_waste',
              lines: [{ id: 'new', description: '15mm copper', qty: 10, unit_cents: 4_800 }],
            })
          }
        >
          Order from supplier
        </button>
        <Link href="/dashboard/suppliers/po" className="ml-3 text-sm font-bold text-[#00b4d8]">Purchase orders</Link>
      </section>
    </div>
  );
}

export function TradeTeam() {
  const { book } = useTradeBook();
  return (
    <div className="space-y-4">
      <PageHead kicker="People" title="Team" detail="Owners and technicians. Each person has a work app.">
        <Link href="/dashboard/my-business/team" className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm">Company permissions</Link>
      </PageHead>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {book.desk.team.map((member) => {
          const jobs = book.desk.programmes.filter((row) => row.assignees.includes(member.id)).length;
          return (
            <li key={member.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black"
                  style={{ backgroundColor: member.colour, color: member.colour.toLowerCase() === '#00b4d8' ? '#0f172a' : '#fff' }}
                >
                  {member.name.split(' ').slice(0, 2).map((part) => part.slice(0, 1)).join('')}
                </span>
                <div className="min-w-0">
                  <p className="font-black text-slate-900">{member.name}</p>
                  <p className="text-sm text-slate-600">{member.trade}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <StatusPill status={member.role} />
                <span className="text-xs font-bold text-slate-500">{jobs} job{jobs === 1 ? '' : 's'}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{member.email}</p>
              <p className="text-sm text-slate-600">{member.phone}</p>
              <Link href={`/crew/tradegraph/${member.portal_token}`} className="mt-3 inline-flex min-h-10 items-center rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a]">Open their work app</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function quotePdfHref(publicToken: string, quoteId: string): string {
  const token = publicToken === 'tg_harbour' || publicToken === 'demo' ? 'demo' : publicToken;
  return `/api/public/tradegraph/quote-pdf?token=${encodeURIComponent(token)}&quote=${encodeURIComponent(quoteId)}`;
}

export function QuoteSheet({ quoteId }: { quoteId: string }) {
  const { book } = useTradeBook();
  const quote = book.store.quotes.find((row) => row.id === quoteId) || book.store.quotes[0];
  if (!quote) return <TradeEmpty title="No quote yet" hint="Save a draft in the quote builder first." />;
  const customer = book.store.customers.find((row) => row.id === quote.customer_id);
  const totals = quoteTotals(quote.lines, book.store.settings.vat_rate);
  const meta = book.desk.quote_meta.find((row) => row.quote_id === quote.id);
  return (
    <article className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" data-testid="quote-sheet">
      <div className="bg-[#00b4d8] px-6 py-5 text-[#0f172a]">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f172a]/70">TradeAdvisor®</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{book.store.settings.brand_name}</h1>
        <p className="text-sm font-semibold text-[#0f172a]/80">{book.store.settings.city} · {book.store.settings.phone}</p>
      </div>
      <div className="p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">{quote.number}</p>
        <h2 className="mt-1 text-lg font-black text-slate-900">{quote.title}</h2>
        <p className="text-sm">{customer?.name}<br />{customer?.address}, {customer?.suburb}</p>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-100">
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-right">{line.qty}</td>
                <td className="py-2 text-right">{formatZar(Math.round(line.qty * line.unit_cents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <TradeStat value={formatZar(totals.subtotal_cents)} label="Ex VAT" />
          <TradeStat value={formatZar(totals.vat_cents)} label="VAT 15%" />
          <TradeStat value={formatZar(totals.total_cents)} label="Incl VAT" />
        </div>
        {meta?.deposit_pct ? <p className="text-sm">Deposit {meta.deposit_pct}% on acceptance.</p> : null}
        {meta?.signature ? <p className="mt-4 text-sm">Signed by {meta.signature.name} on {meta.signature.signed_at.slice(0, 10)}.</p> : null}
        <a className="mt-4 inline-block text-sm font-bold text-[#00b4d8]" href={quotePdfHref(book.store.settings.public_token, quote.id)}>
          Download PDF
        </a>
      </div>
    </article>
  );
}
