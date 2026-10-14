'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTradeBook } from '@/components/trades/TradeBook';
import { PageHead, StatusPill, bookToday } from '@/components/trades/TradeOffice';
import { TradeHeading } from '@/components/trades/TradeUi';

export function TradeTasks() {
  const { book, dispatch } = useTradeBook();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('2026-10-16');
  const open = book.desk.tasks.filter((row) => !row.done).length;
  return (
    <div className="space-y-4">
      <PageHead kicker="Yard" title="Tasks" detail={`${open} open follow-up${open === 1 ? '' : 's'} for the office and the van.`} />
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: 'save_task', title, due, assignee_id: book.desk.team[1]?.id || null });
          setTitle('');
        }}
      >
        <TradeHeading hint="Due date stays on the card.">Add a task</TradeHeading>
        <label className="mt-3 block text-sm font-semibold">
          Task
          <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Due
          <input className="mt-1 min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </label>
        <button className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" type="submit">
          Add task
        </button>
      </form>
      <ul className="space-y-2">
        {book.desk.tasks.map((task) => (
          <li key={task.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" checked={task.done} onChange={() => dispatch({ type: 'toggle_task', task_id: task.id })} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-black ${task.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</span>
                  <StatusPill status={task.done ? 'done' : 'due'} />
                </span>
                <span className="mt-1 block text-slate-600">Due {task.due}</span>
              </span>
            </label>
          </li>
        ))}
        {!book.desk.tasks.length ? <Empty>No open tasks. Add a follow-up after a site visit.</Empty> : null}
      </ul>
    </div>
  );
}

export function TradeMessages() {
  const { book, dispatch } = useTradeBook();
  const [customerId, setCustomerId] = useState(book.store.customers[0]?.id || '');
  const [body, setBody] = useState('');
  const thread = book.desk.messages.filter((row) => row.customer_id === customerId);
  return (
    <div className="space-y-4">
      <PageHead kicker="People" title="Messages" detail="Desk notes and replies, one customer at a time." />
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <ul className="space-y-2">
        {book.store.customers.map((customer) => (
          <li key={customer.id}>
            <button
              type="button"
              className={`w-full rounded-2xl px-3 py-2 text-left text-sm font-bold ${customerId === customer.id ? 'bg-[#00b4d8] text-[#0f172a]' : 'bg-white text-slate-800'}`}
              onClick={() => setCustomerId(customer.id)}
            >
              {customer.name}
            </button>
          </li>
        ))}
      </ul>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <TradeHeading>{book.store.customers.find((row) => row.id === customerId)?.name || 'Thread'}</TradeHeading>
        <ul className="mt-3 space-y-2">
          {thread.map((row) => (
            <li key={row.id} className={`rounded-2xl px-3 py-2 text-sm ${row.from === 'desk' ? 'bg-sky-50' : 'bg-slate-50'}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{row.from === 'desk' ? 'You' : 'Customer'}</p>
              <p>{row.body}</p>
            </li>
          ))}
          {!thread.length ? <Empty>No messages with this customer yet.</Empty> : null}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({ type: 'message', customer_id: customerId, from: 'desk', body });
            setBody('');
          }}
        >
          <label className="sr-only" htmlFor="trade-message">Message</label>
          <input id="trade-message" className="flex-1 min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30 text-sm" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write to the customer" required />
          <button className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" type="submit">Send</button>
        </form>
      </section>
    </div>
    </div>
  );
}

export function TradeSites() {
  const { book, dispatch } = useTradeBook();
  const [customerId, setCustomerId] = useState(book.store.customers[0]?.id || '');
  const [label, setLabel] = useState('House');
  const [address, setAddress] = useState('');
  return (
    <div className="space-y-4">
      <PageHead kicker="People" title="Sites" detail="A customer can have more than one property." />
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: 'add_site', customer_id: customerId, label, address, suburb: '', city: book.store.settings.city });
          setAddress('');
        }}
      >
        <TradeHeading hint="The customer address stays on their card.">Add a site</TradeHeading>
        <label className="mt-3 block text-sm font-semibold">
          Customer
          <select className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            {book.store.customers.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Label
          <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={label} onChange={(event) => setLabel(event.target.value)} required />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Address
          <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={address} onChange={(event) => setAddress(event.target.value)} required />
        </label>
        <button className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" type="submit">Save site</button>
      </form>
      <ul className="space-y-2">
        {book.desk.sites.map((site) => {
          const customer = book.store.customers.find((row) => row.id === site.customer_id);
          return (
            <li key={site.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-black text-slate-900">{site.label}</p>
                <StatusPill status="site" />
              </div>
              <p className="mt-1 font-bold text-slate-700">{customer?.name}</p>
              <p className="text-slate-600">{site.address}, {site.suburb} {site.city}</p>
              <a className="mt-2 inline-flex min-h-10 items-center rounded-2xl border border-slate-200 px-3 text-xs font-black text-slate-800" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.address} ${site.suburb}`)}`}>Open in maps</a>
            </li>
          );
        })}
        {!book.desk.sites.length ? <Empty>No extra sites yet. The customer address is still on their card.</Empty> : null}
      </ul>
    </div>
  );
}

export function TradeReviews() {
  const { book } = useTradeBook();
  return (
    <div className="space-y-4">
      <PageHead kicker="People" title="Reviews" detail="Customers leave these from their app after handover." />
      <ul className="space-y-2">
        {book.desk.reviews.map((review) => {
          const customer = book.store.customers.find((row) => row.id === review.customer_id);
          return (
            <li key={review.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-slate-900">{customer?.name || 'Customer'}</p>
                <span className="rounded-full bg-[#00b4d8] px-2 py-0.5 text-xs font-black text-[#0f172a]">{review.score}/5</span>
              </div>
              <p className="mt-2 text-slate-700">{review.comment}</p>
            </li>
          );
        })}
        {!book.desk.reviews.length ? <Empty>No reviews yet. Ask after handover.</Empty> : null}
      </ul>
    </div>
  );
}

export function TradeNotices() {
  const { book, dispatch } = useTradeBook();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  return (
    <div className="space-y-4">
      <PageHead kicker="Yard" title="Notices" detail="Shown to the team and, when you message them, to customers." />
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: 'add_notice', title, body });
          setTitle('');
          setBody('');
        }}
      >
        <TradeHeading>Post a notice</TradeHeading>
        <label className="mt-3 block text-sm font-semibold">
          Title
          <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Body
          <textarea className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={body} onChange={(event) => setBody(event.target.value)} required />
        </label>
        <button className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" type="submit">Post notice</button>
      </form>
      <ul className="space-y-2">
        {book.desk.notices.map((notice) => (
          <li key={notice.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
            <p className="font-black">{notice.title}</p>
            <p className="text-slate-700">{notice.body}</p>
            <p className="text-xs text-slate-500">{notice.at.slice(0, 10)}</p>
          </li>
        ))}
        {!book.desk.notices.length ? <Empty>No notices posted.</Empty> : null}
      </ul>
    </div>
  );
}

export function TradeCompliance() {
  const { book } = useTradeBook();
  const rows = book.store.compliance;
  const today = bookToday(book.store.settings.public_token);
  return (
    <div className="space-y-4">
      <PageHead kicker="Yard" title="Compliance" detail="Certificates of compliance, PIRB, and gas. VerifyNow holds the company badge." />
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-black text-slate-900">{row.kind.toUpperCase()} · {row.holder}</p>
              <StatusPill status={row.expires_on < today ? 'overdue' : 'due'} />
            </div>
            <p className="mt-1 text-slate-600">{row.number}</p>
            <p className="font-bold text-slate-800">Expires {row.expires_on}</p>
          </li>
        ))}
        {!rows.length ? <Empty>No certificates on this book yet.</Empty> : null}
      </ul>
      <Link href="/dashboard/my-business/verify" className="inline-block text-sm font-bold text-[#00b4d8]">Open VerifyNow</Link>
    </div>
  );
}

export function TradeArrival() {
  const { book, dispatch } = useTradeBook();
  const jobs = book.store.jobs.filter((row) => row.status === 'scheduled' || row.status === 'in_progress');
  return (
    <div className="space-y-4">
      <PageHead kicker="Yard" title="Arrival" detail="Clock the moment the van reaches the site." />
      <ul className="space-y-2">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
            <span>
              <span className="font-black">{job.number} · {job.title}</span>
              <span className="mt-1 block text-slate-600">{job.address}</span>
            </span>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]"
              onClick={() => dispatch({ type: 'arrive', job_id: job.id, member_id: book.desk.team[1]?.id || book.desk.team[0]?.id || '' })}
            >
              I have arrived
            </button>
          </li>
        ))}
        {!jobs.length ? <Empty>Nothing is scheduled. Put a job on the calendar first.</Empty> : null}
      </ul>
    </div>
  );
}

export function TradeWebsite({ base }: { base: string }) {
  const { book, dispatch, live, icsToken, rotateIcs } = useTradeBook();
  const [brand, setBrand] = useState(book.store.settings.brand_name);
  const [phone, setPhone] = useState(book.store.settings.phone);
  const [city, setCity] = useState(book.store.settings.city);
  const token = book.store.settings.public_token === 'tg_harbour' ? 'demo' : book.store.settings.public_token;
  const app = `/customer/tradegraph/${token}`;
  const embed = `/embed/tradegraph/${token}`;
  return (
    <div className="space-y-4">
      <PageHead kicker="Yard" title="Website and apps" detail="This is what customers see on quotes, the app, and the embed." />
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: 'save_brand', brand_name: brand, phone, city });
        }}
      >
        <TradeHeading>Brand on the quote sheet</TradeHeading>
        <label className="mt-3 block text-sm font-semibold">
          Trading name
          <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={brand} onChange={(event) => setBrand(event.target.value)} required />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Phone
          <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          City
          <input className="mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30" value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
        <button className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99]" type="submit">Save brand</button>
      </form>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
        <p className="font-black">Customer app</p>
        <Link className="font-bold text-[#00b4d8]" href={app}>{app}</Link>
        <p className="mt-4 font-black">Embed on your site</p>
        <Link className="font-bold text-[#00b4d8]" href={embed}>{embed}</Link>
        <p className="mt-4 font-black">Office</p>
        <Link className="font-bold text-[#00b4d8]" href={base}>{base}</Link>
        {live && book.store.settings.public_token !== 'tg_harbour' ? (
          <div className="mt-4">
            <p className="font-black">Subscribe to calendar</p>
            {icsToken ? (
              <>
                <a className="font-bold text-[#00b4d8]" href={`/api/public/tradegraph/ics?ics=${encodeURIComponent(icsToken)}`}>
                  Subscribe to calendar
                </a>
                <button
                  type="button"
                  className="mt-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold"
                  onClick={() => rotateIcs()}
                >
                  Rotate calendar link
                </button>
                <p className="mt-2 text-slate-600">Keep this link on the desk. Customers and the website embed use a different sign-in.</p>
              </>
            ) : (
              <p className="text-slate-600">The private calendar link appears after the book has its calendar column.</p>
            )}
          </div>
        ) : null}
        <p className="mt-4 text-slate-600">Quotes are in rand with VAT at 15% on top. The cyan bar on the quote sheet is the TradeAdvisor® mark.</p>
      </section>
    </div>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <li className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm font-semibold text-slate-600 shadow-sm">{children}</li>;
}
