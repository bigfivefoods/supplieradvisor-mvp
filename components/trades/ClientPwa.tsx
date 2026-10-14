'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Camera, FileText, HardHat, MessageSquare, Newspaper, Wallet } from 'lucide-react';
import { MemberAdvisorShell, type MemberAdvisorTab } from '@/components/advisors/MemberAdvisorShell';
import { TradeInstallPrompt } from '@/components/trades/TradeInstall';
import { useTradeBook } from '@/components/trades/TradeBook';
import { customerPack } from '@/lib/trades/desk';
import { formatZar, quoteTotals } from '@/lib/trades/tradegraph';
import { ProjectFeedView, ProjectHomeView, ProjectPhotosView, ProjectPlanView } from '@/components/trades/ClientProject';

type Tab = 'home' | 'plan' | 'photos' | 'feed' | 'quotes' | 'money' | 'more';

export function ClientPwa({ customerId, balance }: { customerId: string; balance?: ReactNode }) {
  const { book, dispatch } = useTradeBook();
  const [tab, setTab] = useState<Tab>('home');
  const [name, setName] = useState('');
  const [request, setRequest] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [jobId, setJobId] = useState('');
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

  const activeJob = pack.jobs.find((row) => row.id === jobId) || pack.jobs.find((row) => row.status === 'in_progress') || pack.jobs[0];
  const activeId = activeJob?.id || '';

  const tabs: MemberAdvisorTab<Tab>[] = [
    { id: 'home', label: 'Project', icon: <HardHat />, emphasis: true },
    { id: 'plan', label: 'Plan', icon: <CalendarDays /> },
    { id: 'photos', label: 'Photos', icon: <Camera /> },
    { id: 'feed', label: 'Feed', icon: <Newspaper /> },
    { id: 'quotes', label: 'Quotes', icon: <FileText />, badge: pack.quotes.filter((row) => row.status === 'sent').length || undefined },
    { id: 'money', label: 'Money', icon: <Wallet /> },
    { id: 'more', label: 'More', icon: <MessageSquare /> },
  ];

  return (
    <div data-testid="role-client">
      <MemberAdvisorShell
        color="#00b4d8"
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
        mobileTabs={[tabs[0], tabs[1], tabs[2], tabs[3], tabs[6]]}
        tab={tab}
        onTab={setTab}
      >
        <TradeInstallPrompt />
        {tab === 'home' ? <ProjectHomeView pack={pack} jobId={activeId} onJob={setJobId} balance={balance} /> : null}
        {tab === 'plan' ? <ProjectPlanView pack={pack} jobId={activeId} /> : null}
        {tab === 'photos' ? <ProjectPhotosView pack={pack} jobId={activeId} /> : null}
        {tab === 'feed' ? <ProjectFeedView pack={pack} jobId={activeId} /> : null}
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
        {tab === 'money' ? <Money pack={pack} /> : null}
        {tab === 'more' ? (
          <More
            pack={pack}
            onQuotes={() => setTab('quotes')}
            onMoney={() => setTab('money')}
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
              <button type="button" className="mt-3 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-[#0f172a]" data-testid="accept-quote" onClick={() => onAccept(quote.id)}>
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
              <button type="button" className="rounded-full bg-[#00b4d8] px-3 py-1.5 text-xs font-bold text-[#0f172a]" data-testid="approve-vo" onClick={() => onApprove(vo.id)}>
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
              <a className="mt-2 inline-block font-bold text-[#00b4d8]" href={meta.pay_url}>{meta.pay_reference || 'Pay with Paystack'}</a>
            ) : (
              <p className="text-slate-500">Pay link appears when your tradesperson issues it.</p>
            )}
          </article>
        );
      })}
      {!pack.invoices.length ? <p className="text-sm text-slate-600">No invoices yet.</p> : null}
      <a className="inline-block text-sm font-bold text-[#00b4d8]" href={`/api/public/tradegraph/statement?token=demo`}>
        Download statement
      </a>
    </div>
  );
}

function More({
  pack,
  onQuotes,
  onMoney,
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
  onQuotes: () => void;
  onMoney: () => void;
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
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <button type="button" className="min-h-11 rounded-2xl border border-slate-200 bg-white text-sm font-black" onClick={onQuotes}>
          Quotes
        </button>
        <button type="button" className="min-h-11 rounded-2xl border border-slate-200 bg-white text-sm font-black" onClick={onMoney}>
          Money
        </button>
      </div>
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
        <button className="mt-2 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-[#0f172a]" type="submit">Send request</button>
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
        <button className="mt-2 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-[#0f172a]" type="submit" data-testid="book-slot">Request the slot</button>
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
          <button className="rounded-full bg-[#00b4d8] px-3 py-2 text-xs font-bold text-[#0f172a]" type="submit">Send</button>
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
