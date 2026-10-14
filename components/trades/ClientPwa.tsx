'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, FileText, HardHat, MessageSquare, Wallet } from 'lucide-react';
import { MemberAdvisorShell, type MemberAdvisorTab } from '@/components/advisors/MemberAdvisorShell';
import { B2cInstallPrompt } from '@/components/b2c/B2cInstallPrompt';
import { GanttChart } from '@/components/trades/GanttChart';
import { useTradeBook } from '@/components/trades/TradeBook';
import { customerPack, readGantt, voRegister } from '@/lib/trades/desk';
import { formatZar, quoteTotals } from '@/lib/trades/tradegraph';

type Tab = 'home' | 'quotes' | 'plan' | 'money' | 'more';

export function ClientPwa({ customerId }: { customerId: string }) {
  const { book, dispatch } = useTradeBook();
  const [tab, setTab] = useState<Tab>('home');
  const [name, setName] = useState('');
  const [request, setRequest] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const pack = useMemo(() => {
    try {
      return customerPack(book, customerId);
    } catch {
      return null;
    }
  }, [book, customerId]);

  if (!pack) {
    return <p className="p-6 text-sm">That customer is not on this sample book.</p>;
  }

  const tabs: MemberAdvisorTab<Tab>[] = [
    { id: 'home', label: 'Home', icon: <HardHat /> },
    { id: 'quotes', label: 'Quotes', icon: <FileText />, badge: pack.quotes.filter((row) => row.status === 'sent').length || undefined },
    { id: 'plan', label: 'Plan', icon: <CalendarDays />, emphasis: true },
    { id: 'money', label: 'Money', icon: <Wallet /> },
    { id: 'more', label: 'More', icon: <MessageSquare /> },
  ];

  return (
    <div data-testid="role-client">
      <MemberAdvisorShell
        color="#0077b6"
        presence={false}
        mobileNav="bottom"
        appHref="/preview/tradegraph"
        fromClass="from-sky-50"
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">TradeAdvisor®</p>
            <h1 className="truncate text-xl font-black">{pack.brand.brand_name}</h1>
            <p className="text-sm text-white/90">{pack.customer.name}</p>
          </div>
        }
        tabs={tabs}
        tab={tab}
        onTab={setTab}
      >
        <B2cInstallPrompt />
        {tab === 'home' ? <Home pack={pack} /> : null}
        {tab === 'quotes' ? (
          <Quotes
            pack={pack}
            name={name}
            setName={setName}
            onAccept={(quoteId) => dispatch({ type: 'sign_quote', quote_id: quoteId, name, mark: name })}
            onApprove={(voId) => dispatch({ type: 'approve_vo', vo_id: voId, name, mark: name })}
            onDecline={(voId) => dispatch({ type: 'decline_vo', vo_id: voId })}
          />
        ) : null}
        {tab === 'plan' ? <Plan pack={pack} /> : null}
        {tab === 'money' ? <Money pack={pack} /> : null}
        {tab === 'more' ? (
          <More
            pack={pack}
            request={request}
            setRequest={setRequest}
            note={note}
            setNote={setNote}
            message={message}
            setMessage={setMessage}
            onRequest={() => {
              dispatch({
                type: 'request_job',
                customer_id: pack.customer.id,
                description: request,
                address: pack.customer.address,
                preferred_dates: 'This week',
              });
              setRequest('');
            }}
            onBook={() => {
              dispatch({
                type: 'book_slot',
                customer_id: pack.customer.id,
                starts_at: '2026-10-16T09:00:00.000Z',
                ends_at: '2026-10-16T11:00:00.000Z',
                note: note || 'Please visit',
              });
              setNote('');
            }}
            onMessage={() => {
              dispatch({ type: 'message', customer_id: pack.customer.id, from: 'customer', body: message });
              setMessage('');
            }}
          />
        ) : null}
      </MemberAdvisorShell>
    </div>
  );
}

function Home({ pack }: { pack: NonNullable<ReturnType<typeof customerPack>> }) {
  const active = pack.jobs.find((row) => row.status === 'in_progress' || row.status === 'scheduled') || pack.jobs[0];
  const programme = active ? pack.programmes.find((row) => row.job_id === active.id) : null;
  const gantt = programme ? readGantt(programme.tasks) : null;
  return (
    <div className="space-y-3" data-testid="client-home">
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Balance</p>
        <p className="text-3xl font-black">{formatZar(pack.balance_cents)}</p>
        <p className="text-sm text-slate-600">{pack.brand.city} · {pack.brand.phone}</p>
      </section>
      {active ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#0077b6]">{active.number}</p>
          <h2 className="text-lg font-black">{active.title}</h2>
          <p className="text-sm text-slate-600">{active.address}</p>
          {gantt?.current ? <p className="mt-2 text-sm font-semibold">Current phase: {gantt.current.name}</p> : null}
        </section>
      ) : (
        <p className="rounded-3xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">No active job. Request one from More.</p>
      )}
      <PhotoStrip pack={pack} />
    </div>
  );
}

function PhotoStrip({ pack }: { pack: NonNullable<ReturnType<typeof customerPack>> }) {
  const photos = pack.programmes.flatMap((row) => row.photos);
  if (!photos.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-black">Photo timeline</h3>
      <div className="flex gap-2 overflow-x-auto">
        {photos.map((photo) => (
          <figure key={photo.id} className="w-40 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.caption} className="h-28 w-full rounded-2xl object-cover" />
            <figcaption className="mt-1 text-[11px] text-slate-600">{photo.phase} · {photo.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Quotes({
  pack,
  name,
  setName,
  onAccept,
  onApprove,
  onDecline,
}: {
  pack: NonNullable<ReturnType<typeof customerPack>>;
  name: string;
  setName: (value: string) => void;
  onAccept: (id: string) => void;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold">
        Your name, for the signature
        <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" data-testid="sign-name" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {pack.quotes.map((quote) => {
        const totals = quoteTotals(quote.lines, pack.brand.vat_rate);
        return (
          <article key={quote.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm" data-testid="quote-card">
            <p className="font-black">{quote.number} · {quote.title}</p>
            <p className="text-slate-600">{quote.status} · {formatZar(totals.total_cents)} incl VAT</p>
            <ul className="mt-2 space-y-1">
              {quote.lines.map((line) => (
                <li key={line.id}>{line.qty} × {line.description}</li>
              ))}
            </ul>
            {quote.status === 'sent' ? (
              <button type="button" className="mt-3 rounded-full bg-[#0077b6] px-4 py-2 text-sm font-bold text-white" data-testid="accept-quote" onClick={() => onAccept(quote.id)}>
                Accept and sign
              </button>
            ) : null}
          </article>
        );
      })}
      {!pack.quotes.length ? <p className="text-sm text-slate-600">No quotes waiting.</p> : null}
      <h3 className="pt-2 font-black">Variation orders</h3>
      {pack.variations.map((vo) => (
        <article key={vo.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm" data-testid="vo-card">
          <p className="font-black">{vo.number} · {vo.title}</p>
          <p>{vo.scope}</p>
          <p>{formatZar(vo.cost_cents)} ex VAT · {vo.days} day{vo.days === 1 ? '' : 's'} · {vo.status}</p>
          {vo.status === 'sent' ? (
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded-full bg-[#0077b6] px-3 py-1.5 text-xs font-bold text-white" data-testid="approve-vo" onClick={() => onApprove(vo.id)}>
                Approve and sign
              </button>
              <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold" onClick={() => onDecline(vo.id)}>
                Decline
              </button>
            </div>
          ) : null}
        </article>
      ))}
      {!pack.variations.length ? <p className="text-sm text-slate-600">No variations on your jobs.</p> : null}
    </div>
  );
}

function Plan({ pack }: { pack: NonNullable<ReturnType<typeof customerPack>> }) {
  const { book } = useTradeBook();
  const job = pack.jobs.find((row) => row.status === 'in_progress') || pack.jobs[0];
  const programme = job ? pack.programmes.find((row) => row.job_id === job.id) : null;
  if (!job || !programme) return <p className="text-sm text-slate-600">Your programme appears after a quote is accepted.</p>;
  const register = voRegister(book, job.id, pack.brand.vat_rate);
  return (
    <div className="space-y-3" data-testid="client-gantt">
      <h2 className="text-lg font-black">{job.title}</h2>
      <GanttChart tasks={programme.tasks} readOnly />
      <p className="text-sm">Revised value {formatZar(register.revised_incl_cents)} incl VAT</p>
    </div>
  );
}

function Money({ pack }: { pack: NonNullable<ReturnType<typeof customerPack>> }) {
  return (
    <div className="space-y-2" data-testid="client-money">
      <p className="text-sm">Statement balance <strong>{formatZar(pack.balance_cents)}</strong></p>
      {pack.invoices.map((invoice) => {
        const meta = pack.invoice_meta.find((row) => row.invoice_id === invoice.id);
        return (
          <article key={invoice.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-black">{invoice.number} · {invoice.status}</p>
            <p>{formatZar(invoice.total_cents)} incl VAT</p>
            {meta?.pay_url ? (
              <a className="mt-2 inline-block font-bold text-[#0077b6]" href={meta.pay_url}>{meta.pay_reference || 'Pay with Paystack'}</a>
            ) : (
              <p className="text-slate-500">Pay link appears when your tradesperson issues it.</p>
            )}
          </article>
        );
      })}
      {!pack.invoices.length ? <p className="text-sm text-slate-600">No invoices yet.</p> : null}
      <a className="inline-block text-sm font-bold text-[#0077b6]" href={`/api/public/tradegraph/statement?token=demo`}>
        Download statement
      </a>
    </div>
  );
}

function More({
  pack,
  request,
  setRequest,
  note,
  setNote,
  message,
  setMessage,
  onRequest,
  onBook,
  onMessage,
}: {
  pack: NonNullable<ReturnType<typeof customerPack>>;
  request: string;
  setRequest: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  message: string;
  setMessage: (value: string) => void;
  onRequest: () => void;
  onBook: () => void;
  onMessage: () => void;
}) {
  return (
    <div className="space-y-4">
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4"
        data-testid="request-job"
        onSubmit={(event) => {
          event.preventDefault();
          onRequest();
        }}
      >
        <h3 className="font-black">Request a job</h3>
        <textarea className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={request} onChange={(event) => setRequest(event.target.value)} placeholder="What needs doing?" required />
        <button className="mt-2 rounded-full bg-[#0077b6] px-4 py-2 text-sm font-bold text-white" type="submit">Send request</button>
      </form>
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onBook();
        }}
      >
        <h3 className="font-black">Book a slot</h3>
        <p className="text-sm text-slate-600">Friday 16 October, 09:00–11:00.</p>
        <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What should we bring?" />
        <button className="mt-2 rounded-full bg-[#0077b6] px-4 py-2 text-sm font-bold text-white" type="submit" data-testid="book-slot">Request the slot</button>
      </form>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h3 className="font-black">Messages</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {pack.messages.map((row) => (
            <li key={row.id} className="rounded-2xl bg-slate-50 px-3 py-2">{row.from === 'customer' ? 'You' : pack.brand.brand_name}: {row.body}</li>
          ))}
          {!pack.messages.length ? <li className="text-slate-500">No messages yet.</li> : null}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onMessage();
          }}
        >
          <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message the team" required />
          <button className="rounded-full bg-[#0077b6] px-3 py-2 text-xs font-bold text-white" type="submit">Send</button>
        </form>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h3 className="font-black">Documents</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {pack.documents.map((doc) => (
            <li key={doc.id}>
              <p className="font-bold">{doc.title}</p>
              <p className="text-slate-600">{doc.kind} · {doc.number}</p>
            </li>
          ))}
          {!pack.documents.length ? <li className="text-slate-500">Certificates and warranties appear here.</li> : null}
        </ul>
      </section>
    </div>
  );
}
