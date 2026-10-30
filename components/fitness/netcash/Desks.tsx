'use client';

import Link from 'next/link';
import { savedKeyLabel } from '@/lib/fitness/netcash/mask';
import { formatZar } from '@/lib/fitness/netcash/money';
import type { AccessHold, AuditEvent, BillingLine, BillingRun, Mandate, NetcashSettings } from '@/lib/fitness/netcash/types';
import type { CollectionsOverview } from '@/lib/fitness/netcash/overview';

const btn = 'inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077b6]';
const ghost = 'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077b6]';

export function ModeBanner({ mode }: { mode: 'test' | 'live' }) {
  return (
    <p className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${mode === 'live' ? 'bg-amber-50 text-amber-950' : 'bg-[#00b4d8]/15 text-[#0f172a]'}`}>
      {mode === 'live'
        ? 'Live is selected. This build still refuses live Netcash calls, so no money moves.'
        : 'Test mode. Netcash answers are simulated. No money moves.'}
    </p>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function statusTone(status: string): string {
  if (status === 'paid' || status === 'active' || status === 'valid' || status === 'reconciled') return 'bg-emerald-50 text-emerald-900';
  if (status === 'unpaid' || status === 'reversed' || status === 'invalid' || status === 'cancelled' || status === 'failed') return 'bg-rose-50 text-rose-900';
  if (status === 'suspended' || status === 'review' || status === 'polling') return 'bg-amber-50 text-amber-950';
  return 'bg-slate-100 text-slate-700';
}

export function Pill({ children }: { children: string }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2 text-[11px] font-black ${statusTone(children)}`}>{children}</span>;
}

export function CollectionsDesk({
  overview,
  lines,
  holds,
  mode,
  statementHref,
}: {
  overview: CollectionsOverview;
  lines: BillingLine[];
  holds: AccessHold[];
  mode: 'test' | 'live';
  statementHref: (memberId: string) => string;
}) {
  const rate = (overview.unpaidRateBps / 100).toFixed(1);
  return (
    <div>
      <ModeBanner mode={mode} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Expected" value={formatZar(overview.expectedCents)} hint="Latest attempt per member" />
        <Stat label="Collected" value={formatZar(overview.collectedCents)} />
        <Stat label="Unpaid rate" value={`${rate}%`} hint={formatZar(overview.unpaidCents)} />
        <Stat label="Upcoming run" value={overview.upcoming ? overview.upcoming.actionDate : 'None'} hint={overview.upcoming ? `${overview.upcoming.status} · ${formatZar(overview.upcoming.expectedCents)}` : 'Preview a run to schedule one'} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-black text-[#0f172a]">Failed reasons</h2>
          {overview.reasons.length ? (
            <ul className="mt-3 space-y-2">
              {overview.reasons.map((reason) => (
                <li key={reason.code} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-[#0f172a]">{reason.code} · {reason.label}</span>
                  <span className="text-slate-600">{reason.count} · {formatZar(reason.cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No unpaid reason codes on this book.</p>
          )}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-black text-[#0f172a]">Access holds</h2>
          {holds.length ? (
            <ul className="mt-3 space-y-2">
              {holds.map((hold) => (
                <li key={hold.id} className="text-sm">
                  <span className="font-bold">{hold.memberName}</span>
                  <span className="text-slate-600"> · {hold.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Nobody is held for an unpaid debit order.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">An unpaid debit warns at GymAdvisor® check-in. Access stays open.</p>
        </section>
      </div>
      <MemberTable lines={lines} statementHref={statementHref} />
    </div>
  );
}

export function MemberTable({ lines, statementHref }: { lines: BillingLine[]; statementHref: (memberId: string) => string }) {
  const latest = new Map<string, BillingLine>();
  for (const line of lines) {
    const prev = latest.get(line.memberId);
    if (!prev || line.attempt >= prev.attempt) latest.set(line.memberId, line);
  }
  const rows = [...latest.values()];
  return (
    <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-sm font-black text-[#0f172a]">Members</h2>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((line) => (
          <Link key={line.id} href={statementHref(line.memberId)} className="block px-4 py-3">
            <span className="font-black text-[#0f172a]">{line.memberName}</span>
            <span className="mt-1 flex items-center justify-between gap-2 text-sm">
              <Pill>{line.collectionStatus}</Pill>
              <span className="font-bold">{formatZar(line.totalCents)}</span>
            </span>
          </Link>
        ))}
      </div>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-2">Member</th>
            <th className="px-4 py-2">Invoice</th>
            <th className="px-4 py-2">Total</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => (
            <tr key={line.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-bold">
                <Link href={statementHref(line.memberId)} className="text-[#0077b6] underline">{line.memberName}</Link>
              </td>
              <td className="px-4 py-3">{line.invoiceNumber || '—'}</td>
              <td className="px-4 py-3">{formatZar(line.totalCents)}</td>
              <td className="px-4 py-3"><Pill>{line.collectionStatus}</Pill></td>
              <td className="px-4 py-3 text-slate-600">{line.netcashReasonText || line.skipReason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MandateDesk({ mandates }: { mandates: Mandate[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="divide-y divide-slate-100 md:hidden">
        {mandates.map((mandate) => (
          <article key={mandate.id} className="px-4 py-3">
            <h3 className="font-black text-[#0f172a]">{mandate.memberName}</h3>
            <p className="text-sm text-slate-600">{mandate.bankName} · •••• {mandate.accountLast4} · day {mandate.debitDay}</p>
            <p className="mt-2 flex flex-wrap gap-2"><Pill>{mandate.status}</Pill><Pill>{mandate.validationStatus}</Pill></p>
          </article>
        ))}
      </div>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-2">Member</th>
            <th className="px-4 py-2">Bank</th>
            <th className="px-4 py-2">Account</th>
            <th className="px-4 py-2">Signed</th>
            <th className="px-4 py-2">Validation</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {mandates.map((mandate) => (
            <tr key={mandate.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-bold">{mandate.memberName}</td>
              <td className="px-4 py-3">{mandate.bankName}<span className="block text-xs text-slate-500">{mandate.branchCode} · {mandate.accountType}</span></td>
              <td className="px-4 py-3 font-mono">•••• {mandate.accountLast4}</td>
              <td className="px-4 py-3">{mandate.signedAt ? new Date(mandate.signedAt).toLocaleString('en-ZA') : '—'}</td>
              <td className="px-4 py-3"><Pill>{mandate.validationStatus}</Pill></td>
              <td className="px-4 py-3"><Pill>{mandate.status}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RunsDesk({ runs, audit }: { runs: BillingRun[]; audit: AuditEvent[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-3">
        {runs.map((run) => (
          <article key={run.id} className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{run.periodKey}</p>
                <h2 className="text-xl font-black text-[#0f172a]">Action date {run.actionDate}</h2>
                <p className="mt-1 max-w-xl text-sm text-slate-600">{run.actionDateNote}</p>
                <p className="mt-1 text-sm font-bold text-[#0f172a]">{run.approvedAt ? `Approved ${run.approvedAt.slice(0, 16).replace('T', ' ')}` : 'Needs owner approval before submit'}</p>
              </div>
              <Pill>{run.status}</Pill>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-[10px] font-black uppercase text-slate-500">Expected</dt><dd className="font-black">{formatZar(run.expectedCents)}</dd></div>
              <div><dt className="text-[10px] font-black uppercase text-slate-500">Collected</dt><dd className="font-black">{formatZar(run.collectedCents)}</dd></div>
              <div><dt className="text-[10px] font-black uppercase text-slate-500">Batch</dt><dd className="truncate font-bold">{run.netcashBatchId || 'Not submitted'}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <aside className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-black text-[#0f172a]">Batch audit</h2>
        <ol className="mt-3 space-y-3">
          {audit.map((event) => (
            <li key={event.id}>
              <p className="text-sm font-bold text-[#0f172a]">{event.action}</p>
              <p className="text-xs text-slate-500">{event.createdAt.slice(0, 16).replace('T', ' ')} · {event.actor}</p>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

export function SettingsDesk({ settings }: { settings: NetcashSettings }) {
  return (
    <div>
      <ModeBanner mode={settings.mode} />
      <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-2">
        <h2 className="text-sm font-black text-[#0f172a]">Merchant account</h2>
        <p className="mt-2 font-mono text-lg font-black">{settings.merchantAccount || 'Not set'}</p>
        <p className="mt-3 text-sm text-slate-600">
          {settings.serviceKeyConfigured ? savedKeyLabel(settings.serviceKeyLast4) : 'No Debit Order service key is stored for this gym.'} The key is not sent back to this screen.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={btn}>Test</span>
          <span className={ghost}>Live</span>
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-black">Schedule</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li>Cadence {settings.cadence}, debit day {settings.debitDay}</li>
          <li>Cut-off {String(settings.cutoffHourSast).padStart(2, '0')}:{String(settings.cutoffMinute).padStart(2, '0')} SAST, {settings.leadBusinessDays} business days before</li>
          <li>VAT {settings.vatBps / 100}% {settings.pricesIncludeVat ? 'included in the member price' : 'added on top'}</li>
          <li>Auto-submit {settings.autoSubmit ? 'on' : 'off'}. Every run still needs owner approval.</li>
          <li>Retries {settings.retryMaxAttempts} · failed-debit fee {formatZar(settings.lateFeeCents)}</li>
        </ul>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-black">Finance</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li>Bank {settings.glBankCode}</li>
          <li>Accounts receivable {settings.glArCode}</li>
          <li>Membership revenue {settings.glRevenueCode}</li>
          <li>VAT output {settings.glVatCode}</li>
          <li>Fee income {settings.glFeeCode}</li>
          <li>Invoice sequence {settings.invoicePrefix} · credit notes {settings.creditPrefix}</li>
        </ul>
      </section>
      </div>
    </div>
  );
}

export function StatementDesk({ memberName, lines, runs }: { memberName: string; lines: BillingLine[]; runs: BillingRun[] }) {
  const byRun = new Map(runs.map((run) => [run.id, run]));
  const total = lines.filter((line) => line.attempt === 1).reduce((sum, line) => sum + line.totalCents, 0);
  return (
    <div>
      <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Statement</p>
        <h2 className="text-2xl font-black text-[#0f172a]">{memberName}</h2>
        <p className="mt-1 text-sm text-slate-600">Invoices raised by GymAdvisor® for SupplierAdvisor® finance. Account numbers are not on this statement.</p>
        <p className="mt-3 text-lg font-black">{formatZar(total)}</p>
      </div>
      <ol className="space-y-3">
        {lines.map((line) => {
          const run = byRun.get(line.runId);
          return (
            <li key={line.id} className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-black text-[#0f172a]">{line.invoiceNumber || 'Draft'} · {formatZar(line.totalCents)}</p>
                  <p className="text-sm text-slate-600">{line.description}</p>
                  <p className="text-xs text-slate-500">Debit {run?.actionDate || '—'} · attempt {line.attempt} · VAT {formatZar(line.vatCents)}</p>
                  {line.creditNoteNumber ? <p className="text-sm font-bold">Credit note {line.creditNoteNumber}</p> : null}
                </div>
                <Pill>{line.collectionStatus}</Pill>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export { btn, ghost };
