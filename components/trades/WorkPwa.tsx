'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, HardHat, Inbox, Sun, Users, Wallet } from 'lucide-react';
import { TradeEmpty, TradeHero, TradeStat, tradeBtn, tradeCardPad, tradeField, tradeLabel, tradeLink, tradeNested } from '@/components/trades/TradeUi';
import { MemberAdvisorShell, type MemberAdvisorTab } from '@/components/advisors/MemberAdvisorShell';
import { AdvisorWorkPwaChrome, type AdvisorWorkTab } from '@/components/services/AdvisorWorkPwaChrome';
import { TradeInstallPrompt } from '@/components/trades/TradeInstall';
import { GanttChart } from '@/components/trades/GanttChart';
import { useTradeBook } from '@/components/trades/TradeBook';
import { jobsForMember, tradeReport } from '@/lib/trades/desk';
import { FeedComposer } from '@/components/trades/FeedComposer';
import { formatZar } from '@/lib/trades/tradegraph';

type OwnerTab = 'today' | 'jobs' | 'money' | 'team' | 'you';

export function WorkPwa({
  role,
  memberId,
}: {
  role: 'owner' | 'technician';
  memberId: string;
}) {
  if (role === 'owner') return <OwnerApp />;
  return <TechnicianApp memberId={memberId} />;
}

function OwnerApp() {
  const { book } = useTradeBook();
  const [tab, setTab] = useState<OwnerTab>('today');
  const report = tradeReport(book);
  const tabs: MemberAdvisorTab<OwnerTab>[] = [
    { id: 'today', label: 'Today', icon: <Sun /> },
    { id: 'jobs', label: 'Jobs', icon: <HardHat /> },
    { id: 'money', label: 'Money', icon: <Wallet />, emphasis: true },
    { id: 'team', label: 'Team', icon: <Users /> },
    { id: 'you', label: 'You', icon: <Inbox /> },
  ];
  return (
    <div data-testid="role-owner">
      <MemberAdvisorShell
        color="#00b4d8"
        solidBrand
        presence={false}
        mobileNav="bottom"
        appHref="/dashboard/tradegraph"
        fromClass="from-sky-50"
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f172a]/70">Owner · TradeAdvisor®</p>
            <h1 className="truncate text-xl font-black text-[#0f172a]">{book.store.settings.brand_name}</h1>
          </div>
        }
        tabs={tabs}
        tab={tab}
        onTab={setTab}
      >
        <TradeInstallPrompt />
        {tab === 'today' ? <Today jobs={book.store.jobs} schedule={book.store.schedule} /> : null}
        {tab === 'jobs' ? (
          <div className="space-y-3">
            <ul className="space-y-2">
              {book.store.jobs.map((job) => (
                <li key={job.id} className={tradeCardPad}>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">{job.number}</p>
                  <p className="mt-1 font-black text-slate-900">{job.title}</p>
                  <p className="mt-0.5 text-sm capitalize text-slate-600">{job.status.replace(/_/g, ' ')} · {job.address}</p>
                </li>
              ))}
            </ul>
            {!book.store.jobs.length ? <TradeEmpty title="No jobs yet" hint="New work lands here from the office board." icon={<HardHat />} /> : null}
            {book.store.jobs[0] ? <FeedComposer jobId={(book.store.jobs.find((row) => row.status === 'in_progress') || book.store.jobs[0]).id} author="Owner" /> : null}
          </div>
        ) : null}
        {tab === 'money' ? (
          <section className="space-y-3" data-testid="money-panel">
            <TradeHero kicker="Wallet" title={formatZar(report.outstanding_cents)} detail={`Outstanding · win rate ${Math.round(report.win_rate * 100)}%`} />
            <div className="grid grid-cols-2 gap-2">
              <TradeStat value={report.won} label="Quotes won" />
              <TradeStat value={report.decided} label="Decided" />
            </div>
            <ul className="space-y-2">
              {book.store.invoices.map((invoice) => (
                <li key={invoice.id} className={`${tradeNested} flex items-center justify-between gap-3`}>
                  <span className="min-w-0">
                    <span className="block font-black text-slate-900">{invoice.number}</span>
                    <span className="text-xs capitalize text-slate-500">{invoice.status}</span>
                  </span>
                  <span className="shrink-0 font-black tabular-nums">{formatZar(invoice.total_cents)}</span>
                </li>
              ))}
            </ul>
            {!book.store.invoices.length ? <TradeEmpty title="No invoices yet" hint="Invoice a job from the office Gantt." /> : null}
          </section>
        ) : null}
        {tab === 'team' ? (
          <ul className="space-y-2">
            {book.desk.team.map((member) => (
              <li key={member.id} className={tradeCardPad}>
                <p className="font-black text-slate-900">{member.name}</p>
                <p className="text-sm text-slate-600">{member.trade}</p>
                <Link className={`mt-2 inline-block ${tradeLink}`} href={`/crew/tradegraph/${member.portal_token}`}>Their work app</Link>
              </li>
            ))}
            {!book.desk.team.length ? <TradeEmpty title="No team on this book" hint="Add people from the office team page." icon={<Users />} /> : null}
          </ul>
        ) : null}
        {tab === 'you' ? (
          <div className="space-y-3 text-sm">
            <TradeHero kicker="TradeAdvisor®" title="Business overview" detail={`${report.won} quotes won of ${report.decided} decided.`} />
            <Link className={tradeBtn} href="/dashboard/tradegraph">Open the office</Link>
          </div>
        ) : null}
      </MemberAdvisorShell>
    </div>
  );
}

function TechnicianApp({ memberId }: { memberId: string }) {
  const { book, dispatch } = useTradeBook();
  const [tab, setTab] = useState<AdvisorWorkTab>('today');
  const member = book.desk.team.find((row) => row.id === memberId) || book.desk.team.find((row) => row.role !== 'owner') || book.desk.team[0];
  const jobs = member ? jobsForMember(book, member.id) : [];
  const [minutes, setMinutes] = useState(30);
  return (
    <div data-testid="role-technician">
      <AdvisorWorkPwaChrome
        brand={book.store.settings.brand_name}
        name={member?.name || 'Technician'}
        eyebrow="Technician · TradeAdvisor®"
        accent="#00b4d8"
        surface="light"
        solidBrand
        fromClass="from-sky-50"
        tab={tab}
        onTab={setTab}
        appHref="/preview/tradegraph"
        showInstall={false}
      >
        <TradeInstallPrompt />
        {tab === 'today' ? <Today jobs={jobs} schedule={book.store.schedule.filter((slot) => jobs.some((job) => job.id === slot.job_id))} /> : null}
        {tab === 'diary' ? (
          <div className="space-y-3">
            {jobs.map((job) => {
              const programme = book.desk.programmes.find((row) => row.job_id === job.id);
              if (!programme?.tasks.length) return null;
              return (
                <section key={job.id}>
                  <h2 className="mb-2 font-black">{job.title}</h2>
                  <GanttChart
                    tasks={programme.tasks}
                    members={book.desk.team}
                    onShift={(taskId, days) => dispatch({ type: 'shift_task', job_id: job.id, task_id: taskId, days })}
                  />
                </section>
              );
            })}
            {!jobs.some((job) => book.desk.programmes.find((row) => row.job_id === job.id)?.tasks.length) ? (
              <TradeEmpty title="No programme yet" hint="The plan appears after a quote is accepted and assigned to you." icon={<CalendarDays />} />
            ) : null}
          </div>
        ) : null}
        {tab === 'people' ? (
          <ul className="space-y-2 text-sm">
            {jobs.map((job) => {
              const customer = book.store.customers.find((row) => row.id === job.customer_id);
              return (
                <li key={job.id} className={tradeCardPad}>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">{job.number}</p>
                  <p className="mt-1 font-black text-slate-900">{customer?.name}</p>
                  <p className="text-sm text-slate-700">{job.title}</p>
                  <p className="text-sm text-slate-500">{customer?.phone}</p>
                </li>
              );
            })}
          </ul>
        ) : null}
        {tab === 'inbox' ? (
          <ul className="space-y-2 text-sm">
            {book.desk.messages
              .filter((row) => jobs.some((job) => job.customer_id === row.customer_id))
              .map((row) => (
                <li key={row.id} className={tradeNested}>{row.body}</li>
              ))}
          </ul>
        ) : null}
        {tab === 'me' ? (
          <div className="space-y-3">
            <TradeHero kicker="You" title={member?.name || 'Technician'} detail="Time, photos, and materials. Invoices stay with the owner." />
            {jobs[0] ? (
              <form
                className={tradeCardPad}
                onSubmit={(event) => {
                  event.preventDefault();
                  dispatch({
                    type: 'add_time',
                    job_id: jobs[0].id,
                    member_id: member?.id || '',
                    minutes,
                    note: 'Logged from the work app',
                  });
                }}
              >
                <label className={tradeLabel}>
                  Minutes on {jobs[0].number}
                  <input className={tradeField} type="number" min={1} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
                </label>
                <button className={`mt-3 ${tradeBtn}`} type="submit" data-testid="crew-time">
                  Log time
                </button>
              </form>
            ) : (
              <TradeEmpty title="No jobs are assigned to you" hint="The owner assigns work from the office Gantt." />
            )}
            {jobs[0] ? <FeedComposer jobId={jobs[0].id} author={member?.name || 'Technician'} /> : null}
            <label className={`${tradeCardPad} block text-sm font-semibold`}>
              Site photo
              <input
                className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-black"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  const job = jobs[0];
                  if (!file || !job) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    dispatch({ type: 'add_photo', job_id: job.id, phase: 'after', url: String(reader.result || ''), caption: file.name });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          </div>
        ) : null}
      </AdvisorWorkPwaChrome>
    </div>
  );
}

function Today({
  jobs,
  schedule,
}: {
  jobs: Array<{ id: string; number: string; title: string; address: string; status: string }>;
  schedule: Array<{ id: string; job_id: string | null; title: string; starts_at: string; address: string }>;
}) {
  const today = schedule.filter((slot) => slot.starts_at.slice(0, 10) === '2026-10-14' || slot.starts_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  return (
    <div className="space-y-3" data-testid="work-today">
      <h2 className="text-lg font-black text-slate-900">Today</h2>
      {today.length ? (
        <ul className="space-y-2">
          {today.map((slot) => (
            <li key={slot.id} className={tradeCardPad}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">{slot.starts_at.slice(11, 16)}</p>
              <p className="mt-1 font-black text-slate-900">{slot.title}</p>
              <p className="text-sm text-slate-600">{slot.address}</p>
            </li>
          ))}
        </ul>
      ) : (
        <TradeEmpty title="Nothing booked for today" hint="Visits on the calendar show up here." icon={<Sun />} />
      )}
      <ul className="space-y-2">
        {jobs.slice(0, 6).map((job) => (
          <li key={job.id} className={`${tradeNested} flex items-baseline gap-2`}>
            <span className="font-black text-slate-900">{job.number}</span>
            <span className="min-w-0 truncate text-slate-700">{job.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
