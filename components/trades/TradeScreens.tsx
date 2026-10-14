'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
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
import { GymSectionTitle, GymStat } from '@/components/fitness/GymMemberPwaUi';

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
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
          on ? 'bg-[#0077b6] text-white' : 'border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="mb-4 space-y-2">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="TradeAdvisor®">
        {PRIMARY_LINKS.map(([href, label]) => chip(href, label))}
      </nav>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="More TradeAdvisor®">
        {MORE_LINKS.map(([href, label]) => chip(href, label))}
      </nav>
    </div>
  );
}

export function TradeCommand({ base }: { base: string }) {
  const { book } = useTradeBook();
  const report = tradeReport(book);
  const cards = boardCards(book);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <GymStat value={book.store.customers.length} label="Customers" />
        <GymStat value={cards.filter((row) => row.column === 'in_progress').length} label="On the tools" />
        <GymStat value={formatZar(report.outstanding_cents)} label="Outstanding" />
        <GymStat value={`${Math.round(report.win_rate * 100)}%`} label="Quote win rate" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`${base}/board?new=1`} className="rounded-full bg-[#0077b6] px-4 py-2.5 text-sm font-bold text-white" data-testid="new-job-link">
          New job
        </Link>
        <Link href={`${base}/quote`} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900">
          New quote
        </Link>
        <Link href={base.startsWith('/preview') ? '/preview/tradegraph/work?role=owner' : '/work/tradegraph'} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">
          Open the work app
        </Link>
        <Link href="/customer/tradegraph/demo" className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">
          Customer app
        </Link>
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <GymSectionTitle hint="Harbour Plumbing sample, or your live book.">Today</GymSectionTitle>
        <ul className="mt-3 space-y-2">
          {book.store.schedule
            .filter((slot) => slot.starts_at.slice(0, 10) === '2026-10-14')
            .map((slot) => (
              <li key={slot.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                <p className="font-bold">{slot.title}</p>
                <p className="text-slate-600">{slot.starts_at.slice(11, 16)} · {slot.address}</p>
              </li>
            ))}
        </ul>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <GymSectionTitle>Core links</GymSectionTitle>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
          <Link className="rounded-full bg-slate-100 px-3 py-1.5" href="/dashboard/customers">Customers</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1.5" href="/dashboard/inventory/products">Price book</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1.5" href="/dashboard/suppliers/po">Purchase orders</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1.5" href="/dashboard/accounting">Finance</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1.5" href="/dashboard/my-business/team">Team</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1.5" href="/dashboard/my-business/verify">VerifyNow</Link>
        </div>
      </section>
    </div>
  );
}

export function TradeBoard({ base }: { base: string }) {
  const { book, dispatch } = useTradeBook();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const cards = boardCards(book);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <GymSectionTitle hint="Drag is on the Gantt. Move a card by opening the job.">Job board</GymSectionTitle>
        <button type="button" className="rounded-full bg-[#0077b6] px-4 py-2 text-sm font-bold text-white" data-testid="new-job" onClick={() => setOpen(true)}>
          New job
        </button>
      </div>
      {open ? <NewJobForm onClose={() => setOpen(false)} /> : null}
      <div className="flex gap-3 overflow-x-auto pb-2" data-testid="job-board">
        {BOARD_COLUMNS.map((column) => (
          <section key={column} className="w-64 shrink-0 rounded-3xl bg-slate-100 p-2" data-testid={`column-${column}`}>
            <h3 className="px-2 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
              {COL[column]} · {cards.filter((card) => card.column === column).length}
            </h3>
            <ul className="space-y-2">
              {cards.filter((card) => card.column === column).map((card) => (
                <li key={card.id}>
                  {card.kind === 'job' ? (
                    <Link href={`${base}/gantt?job=${card.ref_id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                      <p className="font-bold">{card.title}</p>
                      <p className="text-slate-600">{card.subtitle}</p>
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
                      <p className="font-bold">{card.title}</p>
                      <p className="text-slate-600">{card.subtitle}</p>
                      <p className="mt-1 text-xs font-bold text-[#0077b6]">Make this a job</p>
                    </button>
                  ) : (
                    <Link href={`${base}/quote?quote=${card.ref_id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                      <p className="font-bold">{card.title}</p>
                      <p className="text-slate-600">{card.subtitle}</p>
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
      className="mb-4 rounded-3xl border border-slate-200 bg-white p-4"
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
        <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" data-testid="job-customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          {book.store.customers.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Title
        <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" data-testid="job-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Site address
        <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="rounded-full bg-[#0077b6] px-4 py-2 text-sm font-bold text-white" data-testid="job-save">Save job</button>
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
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4"
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
        <GymSectionTitle hint="Lines come from the price book. VAT is 15% on top.">Quote builder</GymSectionTitle>
        <label className="mt-3 block text-sm font-semibold">
          Customer
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" data-testid="quote-customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            {book.store.customers.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Link to a job
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" data-testid="quote-job" value={jobId} onChange={(event) => setJobId(event.target.value)}>
            <option value="">No job yet</option>
            {book.store.jobs.filter((row) => row.customer_id === customerId).map((row) => (
              <option key={row.id} value={row.id}>{row.number} · {row.title}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Title
          <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" data-testid="quote-title" value={title} onChange={(event) => setTitle(event.target.value)} />
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
            <li key={line.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-semibold">{line.description}{optional.includes(line.id) ? ' · option' : ''}</span>
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
                className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-bold"
                onClick={() =>
                  setOptional((current) =>
                    current.includes(line.id) ? current.filter((id) => id !== line.id) : [...current, line.id]
                  )
                }
              >
                {optional.includes(line.id) ? 'Included' : 'Make optional'}
              </button>
              <span className="w-24 text-right">{formatZar(Math.round(line.qty * line.unit_cents))}</span>
            </li>
          ))}
          {!lines.length ? <li className="text-sm text-slate-500">Add a labour rate, a material, or a call-out.</li> : null}
        </ul>
        <label className="mt-3 block text-sm font-semibold">
          Deposit %
          <input className="mt-1 w-24 rounded-xl border border-slate-200 px-3 py-2" type="number" min={0} max={100} value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} />
        </label>
        <p className="mt-3 text-sm">
          {formatZar(totals.subtotal_cents)} ex VAT · VAT {formatZar(totals.vat_cents)} · <strong>{formatZar(totals.total_cents)} incl VAT</strong>
        </p>
        <button type="submit" className="mt-4 rounded-full bg-[#0077b6] px-4 py-2.5 text-sm font-bold text-white" data-testid="quote-save">
          Save draft
        </button>
      </form>
      <aside className="space-y-2">
        {book.store.quotes.slice(0, 8).map((quote) => {
          const money = quoteTotals(quote.lines, book.store.settings.vat_rate);
          return (
            <article key={quote.id} className="rounded-3xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-bold">{quote.number} · {quote.title}</p>
              <p className="text-slate-600">{quote.status} · {formatZar(money.total_cents)} incl VAT</p>
              {quote.status === 'draft' ? (
                <button type="button" className="mt-2 rounded-full bg-[#0077b6] px-3 py-1 text-xs font-bold text-white" data-testid={`send-${quote.id}`} onClick={() => dispatch({ type: 'send_quote', quote_id: quote.id })}>
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
              <Link href={`${base}/quote-sheet?quote=${quote.id}`} className="mt-2 block text-xs font-bold text-[#0077b6]">
                Quote sheet
              </Link>
            </article>
          );
        })}
      </aside>
    </div>
  );
}

export function TradeGantt({ jobId }: { jobId?: string }) {
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
  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#0077b6]">{job.number}</p>
        <h2 className="text-2xl font-black">{job.title}</h2>
        <p className="text-sm text-slate-600">{customer?.name} · {job.address}</p>
        <a className="text-sm font-bold text-[#0077b6]" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">
          Open the site in maps
        </a>
      </header>
      <GanttChart
        tasks={programme.tasks}
        members={book.desk.team}
        onShift={(taskId, days) => dispatch({ type: 'shift_task', job_id: job.id, task_id: taskId, days })}
      />
      <form
        className="flex flex-wrap items-end gap-2 rounded-3xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: 'rebaseline', job_id: job.id, reason });
          setReason('');
        }}
      >
        <label className="text-sm font-semibold">
          Re-baseline
          <input className="mt-1 block rounded-xl border border-slate-200 px-3 py-2" data-testid="rebaseline-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why the plan changed" />
        </label>
        <button type="submit" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold">Lock a new plan</button>
        {programme.history.length ? <p className="text-xs text-slate-500">{programme.history.length} earlier baseline{programme.history.length === 1 ? '' : 's'} kept.</p> : null}
      </form>
      <section className="rounded-3xl border border-slate-200 bg-white p-4" data-testid="vo-register">
        <GymSectionTitle hint="Original contract plus approved variations.">Variation orders</GymSectionTitle>
        <p className="mt-2 text-sm">
          Original {formatZar(register.original_cents)} · Approved VOs {formatZar(register.approved_cents)} · <strong>Revised {formatZar(register.revised_cents)} ex VAT</strong> · {formatZar(register.revised_incl_cents)} incl VAT
        </p>
        <ul className="mt-3 space-y-2">
          {register.orders.map((vo) => (
            <li key={vo.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
              <p className="font-bold">{vo.number} · {vo.title} · {vo.status}</p>
              <p>{formatZar(vo.cost_cents)} ex VAT · {vo.days} day{vo.days === 1 ? '' : 's'}</p>
              {vo.status === 'draft' ? (
                <button type="button" className="mt-1 rounded-full bg-[#0077b6] px-3 py-1 text-xs font-bold text-white" onClick={() => dispatch({ type: 'send_vo', vo_id: vo.id })}>
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
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid="vo-title" placeholder="Variation title" value={voTitle} onChange={(event) => setVoTitle(event.target.value)} required />
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid="vo-scope" placeholder="Scope change" value={voScope} onChange={(event) => setVoScope(event.target.value)} required />
          <label className="text-xs font-bold">
            Cost in rands, ex VAT
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" min={0} value={voCost} onChange={(event) => setVoCost(Number(event.target.value))} />
          </label>
          <label className="text-xs font-bold">
            Extra days
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="number" min={0} value={voDays} onChange={(event) => setVoDays(Number(event.target.value))} />
          </label>
          <button type="submit" className="rounded-full bg-[#0077b6] px-4 py-2 text-sm font-bold text-white md:col-span-2" data-testid="vo-save">
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
  const [minutes, setMinutes] = useState(30);
  const [started, setStarted] = useState<number | null>(null);
  if (!job || !programme) return null;
  const gantt = readGantt(programme.tasks);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h3 className="font-black">Notes and checklist</h3>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({ type: 'add_note', job_id: job.id, note, shared: true });
            setNote('');
          }}
        >
          <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note for the customer" />
          <button className="rounded-full bg-[#0077b6] px-3 py-2 text-xs font-bold text-white" type="submit">Share</button>
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
          <input name="label" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Add a check" required />
          <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold" type="submit">Add</button>
        </form>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h3 className="font-black">Photos, time, materials</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {programme.photos.map((photo) => (
            <figure key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption} className="h-28 w-full rounded-2xl object-cover" />
              <figcaption className="text-[11px] text-slate-600">{photo.phase} · {photo.caption}</figcaption>
            </figure>
          ))}
        </div>
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
                dispatch({ type: 'add_photo', job_id: job.id, phase: 'after', url, caption: file.name });
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-[#0077b6] px-3 py-2 text-xs font-bold text-white"
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
          <button type="button" className="rounded-full bg-[#0077b6] px-3 py-2 text-xs font-bold text-white" data-testid="invoice-final" onClick={() => dispatch({ type: 'create_invoice', job_id: job.id, kind: 'final' })}>
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
  return (
    <div className="space-y-3">
      <GymSectionTitle hint="Deposits, progress bills, and Paystack links.">Invoices</GymSectionTitle>
      {late.length ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-black text-amber-950">{late.length} overdue</p>
          <ul className="mt-2 space-y-2 text-sm">
            {late.map((row) => (
              <li key={row.invoice.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{row.invoice.number} · {row.days} days · {formatZar(row.balance_cents)}</span>
                <button
                  type="button"
                  className="rounded-full bg-[#0077b6] px-3 py-1 text-xs font-bold text-white"
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
        <p className="rounded-3xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">No overdue invoices.</p>
      )}
      <ul className="space-y-2">
        {book.store.invoices.map((invoice) => {
          const meta = book.desk.invoice_meta.find((row) => row.invoice_id === invoice.id);
          return (
            <li key={invoice.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-bold">{invoice.number} · {meta?.kind || 'final'} · {invoice.status}</p>
              <p>{formatZar(invoice.total_cents)} incl VAT</p>
              {invoice.status !== 'paid' && invoice.status !== 'void' ? (
                <button
                  type="button"
                  className="mt-2 rounded-full bg-[#0077b6] px-3 py-1.5 text-xs font-bold text-white"
                  data-testid={`pay-link-${invoice.id}`}
                  onClick={() => dispatch({ type: 'pay_link', invoice_id: invoice.id })}
                >
                  Paystack pay link
                </button>
              ) : null}
              {meta?.pay_url ? (
                <a className="mt-2 block text-xs font-bold text-[#0077b6]" href={meta.pay_url} data-testid={`pay-url-${invoice.id}`}>
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
  const { book, dispatch } = useTradeBook();
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week');
  const anchor = '2026-10-14';
  const days = mode === 'day' ? [anchor] : mode === 'week' ? Array.from({ length: 7 }, (_, i) => shift(anchor, i - 3)) : Array.from({ length: 14 }, (_, i) => shift(anchor, i));
  const lanes = book.desk.team;
  return (
    <div>
      <div className="mb-3 flex gap-2">
        {(['day', 'week', 'month'] as const).map((item) => (
          <button key={item} type="button" className={`rounded-full px-3 py-1.5 text-xs font-bold ${mode === item ? 'bg-[#0077b6] text-white' : 'bg-white border border-slate-200'}`} onClick={() => setMode(item)}>
            {item}
          </button>
        ))}
        <a className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold" href={`/api/public/tradegraph/ics?token=${encodeURIComponent(book.store.settings.public_token === 'tg_harbour' ? 'demo' : book.store.settings.public_token)}`}>
          Download ICS
        </a>
      </div>
      <div className="space-y-3">
        {lanes.map((member) => (
          <section key={member.id} className="rounded-3xl border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-black" style={{ color: member.colour }}>{member.name}</h3>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {days.map((day) => {
                const slots = book.store.schedule.filter((slot) => slot.starts_at.slice(0, 10) === day);
                const mine = slots.filter((slot) => {
                  const job = book.store.jobs.find((row) => row.id === slot.job_id);
                  const programme = job ? book.desk.programmes.find((row) => row.job_id === job.id) : null;
                  return programme ? programme.assignees.includes(member.id) : member.role === 'owner';
                });
                return (
                  <div key={day} className="w-36 shrink-0 rounded-2xl bg-slate-50 p-2">
                    <p className="text-[10px] font-bold text-slate-500">{day.slice(5)}</p>
                    {mine.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className="mt-1 w-full rounded-xl bg-[#0077b6] px-2 py-1 text-left text-[11px] font-bold text-white"
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
                    {!mine.length ? <p className="mt-2 text-[11px] text-slate-400">Free</p> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
        <h3 className="font-black">Booking requests</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {book.desk.bookings.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{row.note} · {row.status}</span>
              {row.status === 'requested' ? (
                <button type="button" className="rounded-full bg-[#0077b6] px-3 py-1 text-xs font-bold text-white" onClick={() => dispatch({ type: 'confirm_booking', booking_id: row.id })}>
                  Confirm
                </button>
              ) : null}
            </li>
          ))}
          {!book.desk.bookings.length ? <li className="text-slate-500">No requests yet. Customers book from their app.</li> : null}
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
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <GymStat value={formatZar(report.revenue_cents)} label="Revenue received" />
        <GymStat value={formatZar(report.outstanding_cents)} label="Outstanding" />
        <GymStat value={`${Math.round(report.win_rate * 100)}%`} label="Win rate" />
        <GymStat value={`${report.won}/${report.decided}`} label="Quotes won" />
      </div>
      <ul className="space-y-2">
        {report.jobs.filter((row) => row.revenue_cents || row.cost_cents).map((row) => (
          <li key={row.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-bold">{row.number} · {row.title}</p>
            <p>Revenue {formatZar(row.revenue_cents)} · Cost {formatZar(row.cost_cents)} · Profit {formatZar(row.profit_cents)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TradeCustomers() {
  const { book, dispatch } = useTradeBook();
  const [name, setName] = useState('');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4"
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
        <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" required />
        <button className="mt-3 rounded-full bg-[#0077b6] px-4 py-2 text-sm font-bold text-white" type="submit">Save</button>
      </form>
      <ul className="space-y-2">
        {book.store.customers.map((customer) => {
          const sites = book.desk.sites.filter((row) => row.customer_id === customer.id);
          const link = book.desk.customer_links.find((row) => row.customer_id === customer.id);
          return (
            <li key={customer.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-black">{customer.name}</p>
              <p className="text-slate-600">{customer.address}, {customer.suburb}</p>
              {sites.map((site) => (
                <p key={site.id} className="text-slate-600">{site.label}: {site.address}</p>
              ))}
              <Link className="mt-1 inline-block font-bold text-[#0077b6]" href={link?.connection_id ? `/dashboard/customers/${link.connection_id}` : '/dashboard/customers'}>
                Open in Customers
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TradeMaterials() {
  const { book, dispatch, live, reload } = useTradeBook();
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="font-black">Price book</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {book.desk.price_book.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.kind} · {item.name}</span>
              <span>{formatZar(sellCents(item))}</span>
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
          <Link href="/dashboard/inventory/products" className="self-center text-sm font-bold text-[#0077b6]">Open inventory</Link>
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="font-black">Supplier orders</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {book.store.materials.map((order) => (
            <li key={order.id}>
              <p className="font-bold">{order.supplier_name} · {order.status}</p>
              <p>{order.lines.map((line) => line.description).join(', ')}</p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 rounded-full bg-[#0077b6] px-4 py-2 text-sm font-bold text-white"
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
        <Link href="/dashboard/suppliers/po" className="ml-3 text-sm font-bold text-[#0077b6]">Purchase orders</Link>
      </section>
    </div>
  );
}

export function TradeTeam() {
  const { book } = useTradeBook();
  return (
    <ul className="space-y-2">
      {book.desk.team.map((member) => (
        <li key={member.id} className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="font-black">{member.name}</p>
          <p className="text-sm text-slate-600">{member.role === 'owner' ? 'Owner' : 'Technician'} · {member.trade}</p>
          <p className="text-sm text-slate-600">{member.email}</p>
          <Link href={`/crew/tradegraph/${member.portal_token}`} className="text-sm font-bold text-[#0077b6]">Open their work app</Link>
        </li>
      ))}
      <li>
        <Link href="/dashboard/my-business/team" className="text-sm font-bold text-[#0077b6]">Company members and permissions</Link>
      </li>
    </ul>
  );
}

export function QuoteSheet({ quoteId }: { quoteId: string }) {
  const { book } = useTradeBook();
  const quote = book.store.quotes.find((row) => row.id === quoteId) || book.store.quotes[0];
  if (!quote) return <p>No quote yet.</p>;
  const customer = book.store.customers.find((row) => row.id === quote.customer_id);
  const totals = quoteTotals(quote.lines, book.store.settings.vat_rate);
  const meta = book.desk.quote_meta.find((row) => row.quote_id === quote.id);
  return (
    <article className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white shadow-sm" data-testid="quote-sheet">
      <div className="h-3 rounded-t-3xl bg-[#00b4d8]" />
      <div className="p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[#0077b6]">TradeAdvisor®</p>
        <h1 className="text-2xl font-black">{book.store.settings.brand_name}</h1>
        <p className="text-sm text-slate-600">{book.store.settings.city} · {book.store.settings.phone}</p>
        <h2 className="mt-6 text-lg font-black">{quote.number} · {quote.title}</h2>
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
        <p className="mt-3 text-sm">{formatZar(totals.subtotal_cents)} ex VAT</p>
        <p className="text-sm">VAT 15% {formatZar(totals.vat_cents)}</p>
        <p className="text-lg font-black">{formatZar(totals.total_cents)} incl VAT</p>
        {meta?.deposit_pct ? <p className="text-sm">Deposit {meta.deposit_pct}% on acceptance.</p> : null}
        {meta?.signature ? <p className="mt-4 text-sm">Signed by {meta.signature.name} on {meta.signature.signed_at.slice(0, 10)}.</p> : null}
        <a className="mt-4 inline-block text-sm font-bold text-[#0077b6]" href={`/api/public/tradegraph/quote-pdf?token=demo&quote=${encodeURIComponent(quote.id)}`}>
          Download PDF
        </a>
      </div>
    </article>
  );
}
