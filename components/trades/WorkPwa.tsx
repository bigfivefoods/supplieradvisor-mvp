'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, HardHat, Inbox, Sun, Users, Wallet } from 'lucide-react';
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
        presence={false}
        mobileNav="bottom"
        appHref="/dashboard/tradegraph"
        fromClass="from-sky-50"
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">Owner</p>
            <h1 className="truncate text-xl font-black">{book.store.settings.brand_name}</h1>
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
                <li key={job.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm">
                  <p className="font-black">{job.number} · {job.title}</p>
                  <p className="text-slate-600">{job.status.replace(/_/g, ' ')} · {job.address}</p>
                </li>
              ))}
            </ul>
            {book.store.jobs[0] ? <FeedComposer jobId={(book.store.jobs.find((row) => row.status === 'in_progress') || book.store.jobs[0]).id} author="Owner" /> : null}
          </div>
        ) : null}
        {tab === 'money' ? (
          <section className="space-y-2" data-testid="money-panel">
            <p className="text-3xl font-black">{formatZar(report.outstanding_cents)}</p>
            <p className="text-sm text-slate-600">Outstanding · win rate {Math.round(report.win_rate * 100)}%</p>
            {book.store.invoices.map((invoice) => (
              <p key={invoice.id} className="rounded-2xl bg-white px-3 py-2 text-sm">{invoice.number} · {formatZar(invoice.total_cents)} · {invoice.status}</p>
            ))}
          </section>
        ) : null}
        {tab === 'team' ? (
          <ul className="space-y-2">
            {book.desk.team.map((member) => (
              <li key={member.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm">
                <p className="font-black">{member.name}</p>
                <p className="text-slate-600">{member.trade}</p>
                <Link className="font-bold text-[#00b4d8]" href={`/crew/tradegraph/${member.portal_token}`}>Their work app</Link>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'you' ? (
          <div className="space-y-2 text-sm">
            <p className="font-black">Business overview</p>
            <p>{report.won} quotes won of {report.decided} decided.</p>
            <Link className="inline-block rounded-full bg-[#00b4d8] px-4 py-2 font-bold text-[#0f172a]" href="/dashboard/tradegraph">Open SupplierAdvisor®</Link>
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
        eyebrow="Technician"
        accent="#00b4d8"
        surface="light"
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
              <p className="text-sm text-slate-600">No programme on your jobs yet.</p>
            ) : null}
          </div>
        ) : null}
        {tab === 'people' ? (
          <ul className="space-y-2 text-sm">
            {jobs.map((job) => {
              const customer = book.store.customers.find((row) => row.id === job.customer_id);
              return (
                <li key={job.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="font-black">{customer?.name}</p>
                  <p>{job.title}</p>
                  <p className="text-slate-600">{customer?.phone}</p>
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
                <li key={row.id} className="rounded-2xl bg-white px-3 py-2">{row.body}</li>
              ))}
          </ul>
        ) : null}
        {tab === 'me' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Time, photos, and materials. Invoices stay with the owner.</p>
            {jobs[0] ? (
              <form
                className="rounded-3xl border border-slate-200 bg-white p-4"
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
                <label className="text-sm font-semibold">
                  Minutes on {jobs[0].number}
                  <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" type="number" min={1} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
                </label>
                <button className="mt-3 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-bold text-[#0f172a]" type="submit" data-testid="crew-time">
                  Log time
                </button>
              </form>
            ) : (
              <p className="text-sm">No jobs are assigned to you.</p>
            )}
            {jobs[0] ? <FeedComposer jobId={jobs[0].id} author={member?.name || 'Technician'} /> : null}
            <label className="block text-sm font-semibold">
              Site photo
              <input
                className="mt-1 block w-full text-sm"
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
      <h2 className="text-lg font-black">Today</h2>
      {today.length ? (
        <ul className="space-y-2">
          {today.map((slot) => (
            <li key={slot.id} className="rounded-3xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-black">{slot.starts_at.slice(11, 16)} · {slot.title}</p>
              <p className="text-slate-600">{slot.address}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-3xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">Nothing booked for today.</p>
      )}
      <ul className="space-y-2">
        {jobs.slice(0, 6).map((job) => (
          <li key={job.id} className="rounded-2xl bg-white px-3 py-2 text-sm">
            <span className="font-bold">{job.number}</span> {job.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
