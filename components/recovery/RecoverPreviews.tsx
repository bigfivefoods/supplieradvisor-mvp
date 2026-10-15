/** Labelled sample layouts. Figures here are illustrations, never a live book. */
import { formatRecoverMoney } from '@/lib/recovery/money';
import type { SampleAccount, SampleAttention, SamplePromise } from '@/lib/recovery/sample-desk';

function zar(rands: number) {
  return formatRecoverMoney(Math.round(rands * 100));
}

function SampleMark() {
  return (
    <span className="inline-flex items-center rounded-full border border-cyan-100 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0077b6]">
      Illustration · sample data
    </span>
  );
}

function StageChip({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-[#00b4d8] px-2.5 py-1 text-xs font-bold text-[#0f172a]">
      {label}
    </span>
  );
}

function Spark({ points }: { points: readonly number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const d = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 72;
      const y = 22 - ((point - min) / span) * 16;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 72 24" className="mt-2 h-6 w-[4.5rem]" aria-hidden>
      <path d={d} fill="none" stroke="#0077b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const QUEUE_ROWS = [
  {
    account: 'RA-20418',
    holder: 'Cedar Retail',
    creditor: 'Northline Credit',
    action: 'Call the account holder',
    stage: 'Arrangement',
    amount: 18450,
    clock: '2 days',
  },
  {
    account: 'RA-20441',
    holder: 'Pebble Stores',
    creditor: 'Meridian Finance',
    action: 'Confirm the promise',
    stage: 'Promise',
    amount: 6280.5,
    clock: '5 days',
  },
  {
    account: 'RA-19802',
    holder: 'Oak Lane Grocer',
    creditor: 'Northline Credit',
    action: 'Send the statement',
    stage: 'New',
    amount: 42910,
    clock: '12 days',
  },
] as const;

export type QueueBoardRow = {
  account: string;
  holder: string;
  creditor: string;
  action: string;
  stage: string;
  amount: string;
  clock: string;
};

export function queueRowsFromAccounts(accounts: readonly SampleAccount[]): QueueBoardRow[] {
  return accounts.map((row) => ({
    account: row.ref,
    holder: row.holder,
    creditor: row.creditor,
    action: row.action,
    stage: row.stage,
    amount: row.amount,
    clock: row.clock,
  }));
}

export function QueueBoard({ rows }: { rows: readonly QueueBoardRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
        <div>
          <p className="text-sm font-black text-slate-900">Work queue</p>
          <p className="text-xs text-slate-600">Next action, stage, and amount for each sample account</p>
        </div>
        <SampleMark />
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Creditor</th>
              <th className="px-4 py-3">Next action</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Clock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.account} className="border-t border-[#e2e8f0]">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{row.holder}</div>
                  <div className="text-xs text-slate-600">{row.account}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.creditor}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.action}</td>
                <td className="px-4 py-3">
                  <StageChip label={row.stage} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black tabular-nums text-slate-900">{row.amount}</td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-[#0077b6]">{row.clock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 p-3 md:hidden">
        {rows.map((row) => (
          <li key={row.account} className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-slate-900">{row.holder}</p>
                <p className="text-xs text-slate-600">{row.account}</p>
              </div>
              <StageChip label={row.stage} />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">{row.action}</p>
            <p className="mt-1 whitespace-nowrap text-xs text-slate-600">{row.creditor}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="whitespace-nowrap text-sm font-black tabular-nums text-slate-900">{row.amount}</p>
              <p className="text-sm font-bold tabular-nums text-[#0077b6]">{row.clock}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SampleQueueTable() {
  return (
    <QueueBoard
      rows={QUEUE_ROWS.map((row) => ({
        account: row.account,
        holder: row.holder,
        creditor: row.creditor,
        action: row.action,
        stage: row.stage,
        amount: zar(row.amount),
        clock: row.clock,
      }))}
    />
  );
}

export function NeedsAttention({ items }: { items: readonly SampleAttention[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Needs attention</h2>
        <SampleMark />
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.title} className="flex items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="font-black text-slate-900">{item.title}</p>
              <p className="text-sm leading-snug text-slate-600">{item.detail}</p>
            </div>
            <StageChip label={item.stage} />
          </li>
        ))}
      </ul>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · sample data. These rows are not live accounts on this desk.
      </p>
    </div>
  );
}

export function PromiseTimeline({ items }: { items: readonly SamplePromise[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Promise to pay</h2>
        <SampleMark />
      </div>
      <ol className="px-4 py-2 sm:px-5">
        {items.map((step, index) => (
          <li key={`${step.when}-${step.who}`} className="relative flex gap-4 py-4">
            {index < items.length - 1 ? (
              <span className="absolute left-[15px] top-10 h-[calc(100%-1.25rem)] w-px bg-[#00b4d8]" aria-hidden />
            ) : null}
            <span
              className="relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00b4d8] text-[11px] font-black text-[#0f172a]"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0077b6]">{step.when}</p>
              <p className="text-sm font-black text-slate-900">
                {step.who} · {step.amount}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{step.note}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · sample data. These dates are a picture of a payment arrangement, not receipts.
      </p>
    </div>
  );
}

const CREDITORS = [
  {
    name: 'Northline Credit',
    registration: 'NCR-sample 4412',
    terms: 'Monthly remittance',
    accounts: '128 accounts',
    book: 1240600,
    status: 'Sample book',
  },
  {
    name: 'Meridian Finance',
    registration: 'NCR-sample 2280',
    terms: 'On receipt',
    accounts: '46 accounts',
    book: 386450,
    status: 'Sample draft',
  },
] as const;

export function SampleCreditorCards() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {CREDITORS.map((card) => (
        <article key={card.name} className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Creditor book</p>
              <h3 className="mt-0.5 text-base font-black text-slate-900">{card.name}</h3>
            </div>
            <SampleMark />
          </div>
          <dl className="grid grid-cols-2 gap-px bg-[#e2e8f0]">
            {[
              ['Registration', card.registration],
              ['Remittance', card.terms],
              ['Accounts', card.accounts],
              ['Book', zar(card.book)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center justify-between border-t border-[#e2e8f0] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Status</span>
            <StageChip label={card.status} />
          </div>
        </article>
      ))}
    </div>
  );
}

const MANDATE_STEPS = [
  {
    when: '12 Mar',
    title: 'Northline Credit placed RA-20418',
    detail: `${zar(18450)} arrived with the customer record.`,
  },
  {
    when: '19 Mar',
    title: 'Collections mandate signed',
    detail: 'The authority names the programme and the product.',
  },
  {
    when: '2 Apr',
    title: 'Payment arrangement',
    detail: `${zar(1500)} on the 2nd of each month.`,
  },
  {
    when: '2 May',
    title: 'First receipt',
    detail: `${zar(1500)} illustrated as received. Not a live receipt.`,
  },
] as const;

export function SampleMandateTimeline() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
        <div>
          <p className="text-sm font-black text-slate-900">Payment arrangement</p>
          <p className="text-xs text-slate-600">Cedar Retail · RA-20418 · Northline Credit</p>
        </div>
        <SampleMark />
      </div>
      <ol className="px-4 py-2 sm:px-5">
        {MANDATE_STEPS.map((step, index) => (
          <li key={step.when} className="relative flex gap-4 py-4">
            {index < MANDATE_STEPS.length - 1 ? (
              <span
                className="absolute left-[15px] top-10 h-[calc(100%-1.25rem)] w-px bg-[#00b4d8]"
                aria-hidden
              />
            ) : null}
            <span
              className="relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00b4d8] text-[11px] font-black text-[#0f172a]"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0077b6]">{step.when}</p>
              <p className="text-sm font-black text-slate-900">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const FUNNEL = [
  { label: 'Placed', count: 128, width: '100%' },
  { label: 'Working', count: 74, width: '58%' },
  { label: 'Arranged', count: 31, width: '24%' },
  { label: 'Recovered', count: 12, width: '9%' },
] as const;

export function RecoveryFunnel() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Recovery funnel</h2>
        <SampleMark />
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
        {FUNNEL.map((stage, index) => (
          <div key={stage.label} className="relative rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              0{index + 1} {stage.label}
            </p>
            <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{stage.count}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#00b4d8]" style={{ width: stage.width }} />
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · sample data. These counts are a picture of a book, not this workspace.
      </p>
    </div>
  );
}

const BUCKETS = [
  { label: 'Current', amount: 210000, width: '18%' },
  { label: '30 days', amount: 340000, width: '29%' },
  { label: '60 days', amount: 280000, width: '24%' },
  { label: '90 days', amount: 190000, width: '16%' },
  { label: 'Older', amount: 150000, width: '13%' },
] as const;

export function AgeingBuckets() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Ageing</h2>
        <SampleMark />
      </div>
      <ul className="space-y-3 p-4 sm:p-5">
        {BUCKETS.map((bucket) => (
          <li key={bucket.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3">
            <span className="text-xs font-bold text-slate-700">{bucket.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#f8fafc] ring-1 ring-[#e2e8f0]">
              <span className="block h-full bg-[#0077b6]" style={{ width: bucket.width }} />
            </span>
            <span className="whitespace-nowrap text-right text-xs font-black tabular-nums text-slate-900 sm:text-sm">
              {zar(bucket.amount)}
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · sample data. The bars are a sample ageing picture, not balances on this desk.
      </p>
    </div>
  );
}

const CREW = [
  { name: 'Amahle Nkosi', role: 'Collector', note: 'Works the assigned queue', count: 42 },
  { name: 'Johan Pretorius', role: 'Reviewer', note: 'Checks promises and documents', count: 18 },
  { name: 'Lindiwe Dlamini', role: 'Finance contact', note: 'Sees the sample trust tile', count: 7 },
] as const;

export function WorkloadStrip() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Collector workload</h2>
        <SampleMark />
      </div>
      <ul className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        {CREW.map((person) => (
          <li key={person.name} className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#00b4d8] text-sm font-black text-[#0f172a]"
              aria-hidden
            >
              {person.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-900">{person.name}</span>
              <span className="block text-xs leading-snug text-slate-600">
                {person.role} · {person.note}
              </span>
            </span>
            <span className="ml-auto text-lg font-black tabular-nums text-slate-900">{person.count}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · sample data. These names are not staff on this workspace.
      </p>
    </div>
  );
}

const SAMPLE_KPIS = [
  { label: 'Placed', value: zar(1240600), sub: '128 sample accounts', points: [18, 22, 20, 28, 26, 34, 40] },
  { label: 'Recovered', value: zar(186400), sub: '12 sample accounts', points: [4, 6, 5, 9, 8, 11, 14] },
  { label: 'In trust', value: zar(94250), sub: 'Sample trust picture', points: [8, 7, 9, 8, 10, 9, 11] },
  { label: 'Clocks', value: '6', sub: 'Due this sample week', points: [2, 3, 3, 5, 4, 6, 6] },
] as const;

export function SampleKpiStrip() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Sample desk picture</h2>
        <SampleMark />
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:p-5 lg:grid-cols-4">
        {SAMPLE_KPIS.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{tile.label}</p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-xl">{tile.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-600">{tile.sub}</p>
            <Spark points={tile.points} />
          </div>
        ))}
      </div>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · sample data. The tiles above the illustration stay blank until a real book exists.
      </p>
    </div>
  );
}

const PORTAL_BOARDS = {
  creditor: {
    title: 'Northline Credit',
    intro: 'A sample of the page a creditor will open for their own book.',
    rows: [
      ['Book', zar(1240600)],
      ['Accounts', '128'],
      ['Remittance', 'Monthly'],
      ['Last receipt', zar(1500)],
    ],
  },
  debtor: {
    title: 'Cedar Retail · RA-20418',
    intro: 'A sample next step. This is not a demand and not this person’s balance.',
    rows: [
      ['Arrangement', zar(1500)],
      ['Next date', '2 May'],
      ['Stage', 'Arrangement'],
      ['Who to contact', 'Amahle Nkosi'],
    ],
  },
  attorney: {
    title: 'Matter RA-19802',
    intro: 'A sample matter. It appears here only as an illustration of a mandate.',
    rows: [
      ['Account', 'Oak Lane Grocer'],
      ['Mandate', 'Collections'],
      ['Amount', zar(42910)],
      ['Status', 'Sample only'],
    ],
  },
} as const;

export function SamplePortalBoard({ kind }: { kind: keyof typeof PORTAL_BOARDS }) {
  const board = PORTAL_BOARDS[kind];
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
            Illustration · sample data
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-900">{board.title}</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">{board.intro}</p>
        </div>
        <SampleMark />
      </div>
      <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
        {board.rows.map(([label, value]) => (
          <div key={label} className="border-t border-[#e2e8f0] px-5 py-4">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</dt>
            <dd className="mt-1 text-sm font-black text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
