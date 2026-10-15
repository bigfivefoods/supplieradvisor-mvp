/** Labelled sample layouts. Words and em dashes only — never a live figure. */

const ROWS = [
  { account: 'Sample account', creditor: 'Sample creditor', action: 'Arrange a call', stage: 'New' },
  { account: 'Sample account', creditor: 'Sample creditor', action: 'Confirm a promise', stage: 'Working' },
  { account: 'Sample account', creditor: 'Sample creditor', action: 'Wait for a document', stage: 'Waiting' },
] as const;

function LayoutMark() {
  return (
    <span className="inline-flex items-center rounded-full border border-cyan-100 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0077b6]">
      Sample layout
    </span>
  );
}

export function SampleQueueTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
        <div>
          <p className="text-sm font-black text-slate-900">Work queue</p>
          <p className="text-xs text-slate-600">One row per assigned account</p>
        </div>
        <LayoutMark />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Creditor</th>
              <th className="px-4 py-3">Next action</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-right">Clock</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, index) => (
              <tr key={`${row.action}-${index}`} className="border-t border-[#e2e8f0]">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{row.account}</div>
                  <div className="text-xs text-slate-600">Reference —</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.creditor}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.action}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-[#0077b6]">
                    {row.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-base font-black tabular-nums text-slate-900">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CREDITORS = [
  { name: 'Sample creditor', terms: 'Monthly remittance', status: 'Not active yet' },
  { name: 'Sample creditor', terms: 'On receipt', status: 'Draft' },
] as const;

export function SampleCreditorCards() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {CREDITORS.map((card, index) => (
        <article
          key={`${card.terms}-${index}`}
          className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Creditor book</p>
              <h3 className="mt-0.5 text-base font-black text-slate-900">{card.name}</h3>
            </div>
            <LayoutMark />
          </div>
          <dl className="grid grid-cols-2 gap-px bg-[#e2e8f0]">
            {[
              ['Registration', '—'],
              ['Remittance', card.terms],
              ['Accounts', '—'],
              ['Status', card.status],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

const MANDATE_STEPS = [
  { when: 'Placed', title: 'Sample creditor', detail: 'The book arrives with the customer record.' },
  { when: 'Authority', title: 'Collections', detail: 'The mandate names the programme and the product.' },
  { when: 'Next', title: 'Not active yet', detail: 'Work starts only after the mandate is current.' },
] as const;

export function SampleMandateTimeline() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
        <div>
          <p className="text-sm font-black text-slate-900">Mandate</p>
          <p className="text-xs text-slate-600">Authority to collect, step by step</p>
        </div>
        <LayoutMark />
      </div>
      <ol className="px-4 py-2 sm:px-5">
        {MANDATE_STEPS.map((step, index) => (
          <li key={step.when} className="relative flex gap-4 py-4">
            {index < MANDATE_STEPS.length - 1 ? (
              <span
                className="absolute left-[15px] top-10 h-[calc(100%-1.25rem)] w-px bg-[#e2e8f0]"
                aria-hidden
              />
            ) : null}
            <span className="relative z-[1] mt-0.5 h-8 w-8 shrink-0 rounded-full border border-cyan-100 bg-cyan-50" aria-hidden />
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

const FUNNEL = ['Placed', 'Working', 'Arranged', 'Recovered'] as const;

export function RecoveryFunnel() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Recovery funnel</h2>
        <LayoutMark />
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
        {FUNNEL.map((label, index) => (
          <div key={label} className="relative rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              0{index + 1} {label}
            </p>
            <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">—</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full w-0 rounded-full bg-[#00b4d8]" />
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · not live data. No accounts placed yet, so every stage stays blank.
      </p>
    </div>
  );
}

const BUCKETS = ['Current', '30 days', '60 days', '90 days', 'Older'] as const;

export function AgeingBuckets() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Ageing</h2>
        <LayoutMark />
      </div>
      <ul className="space-y-3 p-4 sm:p-5">
        {BUCKETS.map((label) => (
          <li key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3">
            <span className="text-xs font-bold text-slate-700">{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#f8fafc] ring-1 ring-[#e2e8f0]">
              <span className="block h-full w-0 bg-[#0077b6]" />
            </span>
            <span className="text-right text-sm font-black tabular-nums text-slate-900">—</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · not live data. Buckets fill only after a creditor book is placed.
      </p>
    </div>
  );
}

const CREW = [
  { role: 'Collector', note: 'Works the assigned queue' },
  { role: 'Reviewer', note: 'Checks promises and documents' },
  { role: 'Finance contact', note: 'Sees trust when that book opens' },
] as const;

export function WorkloadStrip() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-slate-800">Team workload</h2>
        <LayoutMark />
      </div>
      <ul className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        {CREW.map((person) => (
          <li key={person.role} className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-white text-sm font-black text-[#0077b6]"
              aria-hidden
            >
              {person.role.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-900">{person.role}</span>
              <span className="block text-xs leading-snug text-slate-600">{person.note}</span>
            </span>
            <span className="ml-auto text-lg font-black tabular-nums text-slate-900">—</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-[#e2e8f0] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
        Illustration · not live data. Names appear when staff are added. Counts stay blank until accounts are assigned.
      </p>
    </div>
  );
}

const PORTAL_BOARDS = {
  creditor: {
    title: 'Creditor book',
    intro: 'The page a creditor will open for their own book.',
    rows: [
      ['Book', 'Sample creditor'],
      ['Remittances', 'Monthly'],
      ['Documents', 'Shared when ready'],
      ['Balance', '—'],
    ],
  },
  debtor: {
    title: 'Next step',
    intro: 'Plain language. No amount and no demand on this screen.',
    rows: [
      ['Next step', 'Arrange a call'],
      ['What to do', 'Wait for a document'],
      ['Who to contact', 'Your advisor'],
      ['Amount', '—'],
    ],
  },
  attorney: {
    title: 'Matter',
    intro: 'A matter appears here only when a mandate allows it.',
    rows: [
      ['Matter', 'Sample account'],
      ['Mandate', 'Collections'],
      ['Documents', 'Shared when ready'],
      ['Status', 'Not open yet'],
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
            Illustration · not live data
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-900">{board.title}</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">{board.intro}</p>
        </div>
        <LayoutMark />
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
