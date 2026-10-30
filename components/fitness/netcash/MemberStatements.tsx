'use client';

import { useEffect, useState } from 'react';
import { formatZar } from '@/lib/fitness/netcash/money';
import { statementShareText, type MonthStatement } from '@/lib/fitness/netcash/member-statement';

const btn = 'inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-[#00b4d8] px-3 text-sm font-black text-[#0f172a]';
const ghost = 'inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#0f172a]';

export function MemberStatements({
  token,
  gymName = 'GymAdvisor®',
  memberName = 'Member',
  statements: provided,
}: {
  token?: string;
  gymName?: string;
  memberName?: string;
  statements?: MonthStatement[];
}) {
  const [rows, setRows] = useState<MonthStatement[]>(provided || []);
  const [name, setName] = useState(memberName);
  const [gym, setGym] = useState(gymName);
  const [open, setOpen] = useState(provided?.[0]?.month || '');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (provided || !token) return;
    let cancelled = false;
    fetch(`/api/public/fitgraph/statements?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          statements?: MonthStatement[];
          memberName?: string;
          gymName?: string;
        };
        if (!response.ok) throw new Error(data.error || 'Could not load statements.');
        if (cancelled) return;
        setRows(data.statements || []);
        if (data.memberName) setName(data.memberName);
        if (data.gymName) setGym(data.gymName);
        setOpen(data.statements?.[0]?.month || '');
      })
      .catch((error: unknown) => {
        if (!cancelled) setNote(error instanceof Error ? error.message : 'Could not load statements.');
      });
    return () => {
      cancelled = true;
    };
  }, [provided, token]);

  async function download(month: string) {
    if (!token) {
      setNote('Sample statement. Download is available from your GymAdvisor® member link.');
      return;
    }
    const response = await fetch(`/api/public/fitgraph/statements/pdf?token=${encodeURIComponent(token)}&month=${month}`);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setNote(data.error || 'Could not download the statement.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GymAdvisor-statement-${month}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function share(statement: MonthStatement) {
    const text = statementShareText({ gymName: gym, memberName: name, statement });
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: `GymAdvisor® statement ${statement.label}`, text });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(text);
    setNote('Statement summary copied. You can paste it into WhatsApp.');
  }

  return (
    <section aria-label="Statements">
      <h3 className="text-sm font-black text-[#0f172a]">Statements</h3>
      <p className="mt-1 text-sm text-slate-600">Your months only, latest first. Invoices, debit orders, and credits.</p>
      {note ? <p className="mt-2 text-sm font-bold">{note}</p> : null}
      {rows.length ? (
        <ul className="mt-3 space-y-2">
          {rows.map((statement) => {
            const expanded = open === statement.month;
            return (
              <li key={statement.month} className="rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? '' : statement.month)}
                >
                  <span>
                    <span className="block font-black text-[#0f172a]">{statement.label}</span>
                    <span className="text-xs text-slate-500">Closing {formatZar(statement.closingCents)}</span>
                  </span>
                  <span className="text-xs font-black uppercase text-[#0077b6]">{expanded ? 'Close' : 'Open'}</span>
                </button>
                {expanded ? (
                  <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <Balance label="Opening" cents={statement.openingCents} />
                      <Balance label="Invoices" cents={statement.invoicedCents} />
                      <Balance label="Collected" cents={statement.collectedCents} />
                      <Balance label="Unpaid" cents={statement.unpaidCents} />
                      <Balance label="Credits" cents={statement.creditCents} />
                      <Balance label="Closing" cents={statement.closingCents} />
                    </dl>
                    <ul className="space-y-2">
                      {statement.entries.map((entry) => (
                        <li key={`${entry.invoiceNumber}-${entry.status}`} className="text-sm">
                          <p className="font-bold text-[#0f172a]">{entry.invoiceNumber || 'Draft'} · {formatZar(entry.totalCents)} · {entry.status}</p>
                          <p className="text-slate-600">{entry.description}</p>
                          {entry.creditNoteNumber ? <p className="text-xs font-bold">Credit note {entry.creditNoteNumber}</p> : null}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button type="button" className={btn} onClick={() => void download(statement.month)}>Download PDF</button>
                      <button type="button" className={ghost} onClick={() => void share(statement)}>Share</button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-500">No statements yet.</p>
      )}
    </section>
  );
}

function Balance({ label, cents }: { label: string; cents: number }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="font-black text-[#0f172a]">{formatZar(cents)}</dd>
    </div>
  );
}
