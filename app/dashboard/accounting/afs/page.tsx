'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Printer, RefreshCw } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import { GaapDisclaimer } from '@/components/accounting/GaapDisclaimer';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import type { AfsLine, AfsNote, AfsPack, AfsSection } from '@/lib/accounting/afs-types';

export default function AfsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [fyStartMonth, setFyStartMonth] = useState(3);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('full_fy', 3)
  );
  const [pack, setPack] = useState<AfsPack | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ companyId: String(companyId) });
        if (privyUserId) params.set('privyUserId', privyUserId);
        const res = await fetch(`/api/accounting/settings?${params}`);
        const data = await res.json();
        const sm = Number(data.settings?.fiscal_year_start_month || 3);
        if (!cancelled && sm >= 1 && sm <= 12) {
          setFyStartMonth(sm);
          setPeriod((prev) =>
            prev.preset === 'full_fy' ? initialPeriodSlicerValue('full_fy', sm) : prev
          );
        }
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
        label: period.label,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/afs?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compile AFS');
      setPack(data.afs || null);
      if (data.afs?.compilation?.warning) {
        toast.message(data.afs.compilation.warning);
      }
    } catch (err) {
      setPack(null);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, period.from, period.to, period.label]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (n: number) =>
    formatMoney(n, pack?.company.currency || 'ZAR', { compact: false });

  return (
    <AccountingPage>
      <style>{`
        @media print {
          nav, aside, header { display: none !important; }
          body { background: white !important; }
          .afs-pack { font-size: 11pt; }
          section { break-inside: avoid; }
        }
        @page { margin: 16mm; }
      `}</style>
      <div className="print:hidden">
        <AccountingHeader
          title="Annual"
          titleAccent="financial statements"
          description="Compiled IFRS-oriented AFS pack from posted journals for the period you select — statement of financial position, profit or loss, changes in equity, cash flows, notes, and policies. Unaudited."
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          }
        />
        <PeriodSlicer
          value={period}
          onChange={setPeriod}
          fyStartMonth={fyStartMonth}
          defaultOpen
        />
      </div>

      <GaapDisclaimer variant="long" className="mb-6" />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !pack ? (
        <Panel>
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            No statements compiled. Check that the company has posted journals in this period.
          </div>
        </Panel>
      ) : (
        <article className="afs-pack space-y-8 text-slate-900">
          <Cover pack={pack} />

          <nav className="print:hidden">
            <SectionLabel>Contents</SectionLabel>
            <Panel>
              <ol className="grid sm:grid-cols-2 gap-1 p-4 text-sm">
                {[
                  ['#sofp', 'Statement of financial position'],
                  ['#soci', 'Statement of profit or loss'],
                  ['#sce', 'Statement of changes in equity'],
                  ['#scf', 'Statement of cash flows'],
                  ['#notes', 'Notes to the financial statements'],
                  ['#policies', 'Accounting policies'],
                ].map(([href, label]) => (
                  <li key={href}>
                    <a href={href} className="text-[#0077b6] hover:underline font-medium">
                      {label}
                    </a>
                  </li>
                ))}
              </ol>
            </Panel>
          </nav>

          <StatementBlock
            id="sofp"
            title="Statement of financial position"
            subtitle={`As at ${pack.period.to} (comparative ${pack.period.priorTo})`}
            pack={pack}
          >
            <Sofp pack={pack} money={money} />
          </StatementBlock>

          <StatementBlock
            id="soci"
            title="Statement of profit or loss and other comprehensive income"
            subtitle={`For the period ${pack.period.from} to ${pack.period.to}`}
            pack={pack}
          >
            <Soci pack={pack} money={money} />
          </StatementBlock>

          <StatementBlock
            id="sce"
            title="Statement of changes in equity"
            subtitle={`For the period ${pack.period.from} to ${pack.period.to}`}
            pack={pack}
          >
            <MoneyTable
              money={money}
              currentLabel={pack.period.label}
              priorLabel={pack.period.priorLabel}
              rows={pack.statementOfChangesInEquity.lines}
            />
          </StatementBlock>

          <StatementBlock
            id="scf"
            title="Statement of cash flows"
            subtitle="Indirect method — for the selected period"
            pack={pack}
          >
            <Scf pack={pack} money={money} />
          </StatementBlock>

          <section id="notes" className="break-inside-avoid">
            <SectionLabel>Notes to the financial statements</SectionLabel>
            <div className="space-y-4">
              {pack.notes.map((n) => (
                <NoteCard key={n.number} note={n} money={money} pack={pack} />
              ))}
            </div>
          </section>

          <section id="policies" className="break-inside-avoid">
            <SectionLabel>Significant accounting policies</SectionLabel>
            <Panel>
              <div className="p-5 sm:p-6 space-y-4">
                {pack.policies.map((p) => (
                  <div key={p.title}>
                    <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>
                    <p className="mt-1 text-sm text-neutral-700 leading-relaxed">{p.body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        </article>
      )}
    </AccountingPage>
  );
}

function Cover({ pack }: { pack: AfsPack }) {
  return (
    <Panel>
      <div className="p-6 sm:p-10 text-center space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
          Annual financial statements
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {pack.company.name}
        </h2>
        <p className="text-sm text-neutral-600">{pack.period.label}</p>
        <p className="text-xs text-neutral-500">
          {pack.period.from} to {pack.period.to}
          {pack.company.registration_number
            ? ` · Reg ${pack.company.registration_number}`
            : ''}
          {pack.company.vat_number ? ` · VAT ${pack.company.vat_number}` : ''}
          {pack.company.country ? ` · ${pack.company.country}` : ''}
        </p>
        <p className="mx-auto max-w-2xl text-xs text-neutral-500 leading-relaxed pt-2">
          {pack.compilation.basis} {pack.compilation.journalCount} posted journal
          {pack.compilation.journalCount === 1 ? '' : 's'} through the reporting date.
          Comparative column is {pack.period.priorLabel} ({pack.period.priorFrom} to{' '}
          {pack.period.priorTo}).
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
          IFRS / SA GAAP basis — compiled, unaudited
        </p>
      </div>
    </Panel>
  );
}

function StatementBlock({
  id,
  title,
  subtitle,
  pack,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  pack: AfsPack;
  children: ReactNode;
}) {
  return (
    <section id={id} className="break-inside-avoid">
      <SectionLabel>{title}</SectionLabel>
      <Panel>
        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="text-sm font-bold text-slate-900">{pack.company.name}</div>
          <div className="text-xs text-neutral-500">{subtitle}</div>
          <div className="text-[11px] text-neutral-400">
            {pack.company.currency} · Accrual basis
          </div>
        </div>
        {children}
      </Panel>
    </section>
  );
}

function Sofp({
  pack,
  money,
}: {
  pack: AfsPack;
  money: (n: number) => string;
}) {
  const s = pack.statementOfFinancialPosition;
  const assetSecs = s.sections.filter((x) => x.key.includes('asset'));
  const liabSecs = s.sections.filter((x) => x.key.includes('liabilit'));
  const eqSecs = s.sections.filter((x) => x.key === 'equity');
  return (
    <div>
      <MoneyTable
        money={money}
        currentLabel={pack.period.to}
        priorLabel={pack.period.priorTo}
        groups={[
          ...assetSecs,
          {
            key: 'ta',
            title: 'Total assets',
            lines: [
              {
                code: '',
                name: 'Total assets',
                current: s.assets.current,
                prior: s.assets.prior,
                bold: true,
              },
            ],
            total: s.assets,
          },
          ...liabSecs,
          ...eqSecs,
          {
            key: 'tle',
            title: 'Total equity and liabilities',
            lines: [
              {
                code: '',
                name: 'Total equity and liabilities',
                current: s.liabilities.current + s.equity.current,
                prior: s.liabilities.prior + s.equity.prior,
                bold: true,
              },
            ],
            total: {
              current: s.liabilities.current + s.equity.current,
              prior: s.liabilities.prior + s.equity.prior,
            },
          },
        ]}
      />
      <p
        className={`px-5 py-3 text-xs ${
          s.balanced.current
            ? 'text-emerald-800'
            : 'text-amber-800'
        }`}
      >
        Accounting equation (current):{' '}
        {s.balanced.current ? 'Assets = equity + liabilities' : 'Out of balance — review journals'}
        {!s.balanced.prior ? ' · Comparative also out of balance' : ''}
      </p>
    </div>
  );
}

function Soci({
  pack,
  money,
}: {
  pack: AfsPack;
  money: (n: number) => string;
}) {
  const p = pack.statementOfProfitOrLoss;
  return (
    <div>
      <MoneyTable
        money={money}
        currentLabel={pack.period.label}
        priorLabel={pack.period.priorLabel}
        groups={p.sections}
        footer={[
          {
            code: '',
            name: 'Profit / (loss) for the period',
            current: p.netIncome.current,
            prior: p.netIncome.prior,
            bold: true,
          },
        ]}
      />
    </div>
  );
}

function Scf({
  pack,
  money,
}: {
  pack: AfsPack;
  money: (n: number) => string;
}) {
  const c = pack.statementOfCashFlows;
  return (
    <div>
      <MoneyTable
        money={money}
        currentLabel={pack.period.label}
        priorLabel={pack.period.priorLabel}
        groups={[
          {
            key: 'op',
            title: 'Cash flows from operating activities',
            lines: c.operating,
            total: c.netOperating,
          },
          {
            key: 'inv',
            title: 'Cash flows from investing activities',
            lines: c.investing,
            total: c.netInvesting,
          },
          {
            key: 'fin',
            title: 'Cash flows from financing activities',
            lines: c.financing,
            total: c.netFinancing,
          },
        ]}
        footer={[
          {
            code: '',
            name: 'Net increase / (decrease) in cash',
            current: c.netChange.current,
            prior: c.netChange.prior,
            bold: true,
          },
          {
            code: '',
            name: 'Cash and cash equivalents at beginning of period',
            current: c.openingCash.current,
            prior: c.openingCash.prior,
          },
          {
            code: '',
            name: 'Cash and cash equivalents at end of period',
            current: c.closingCash.current,
            prior: c.closingCash.prior,
            bold: true,
          },
        ]}
      />
      {!c.reconciled.current && (
        <p className="px-5 py-3 text-xs text-amber-800">
          Cash-flow net change does not fully reconcile to the cash book — review
          unclassified movements.
        </p>
      )}
    </div>
  );
}

function NoteCard({
  note,
  money,
  pack,
}: {
  note: AfsNote;
  money: (n: number) => string;
  pack: AfsPack;
}) {
  return (
    <Panel>
      <div className="p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900">
          {note.number}. {note.title}
        </h3>
        {note.body ? (
          <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{note.body}</p>
        ) : null}
        {note.lines && note.lines.length > 0 ? (
          <div className="mt-3">
            <MoneyTable
              money={money}
              currentLabel={pack.period.to}
              priorLabel={pack.period.priorTo}
              rows={note.lines}
              compact
            />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function MoneyTable({
  money,
  currentLabel,
  priorLabel,
  rows,
  groups,
  footer,
  compact,
}: {
  money: (n: number) => string;
  currentLabel: string;
  priorLabel: string;
  rows?: AfsLine[];
  groups?: AfsSection[];
  footer?: AfsLine[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? '' : 'overflow-x-auto'}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-neutral-400">
            <th className="px-5 py-2 text-left font-semibold"> </th>
            <th className="px-5 py-2 text-right font-semibold">{currentLabel}</th>
            <th className="px-5 py-2 text-right font-semibold">{priorLabel}</th>
          </tr>
        </thead>
        <tbody>
          {groups?.map((g) => (
            <GroupRows key={g.key} group={g} money={money} />
          ))}
          {rows?.map((r, i) => (
            <LineRow key={`${r.code}-${r.name}-${i}`} line={r} money={money} />
          ))}
          {footer?.map((r, i) => (
            <LineRow key={`f-${r.name}-${i}`} line={r} money={money} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group,
  money,
}: {
  group: AfsSection;
  money: (n: number) => string;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={3}
          className="px-5 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500"
        >
          {group.title}
        </td>
      </tr>
      {group.lines.map((l, i) => (
        <LineRow key={`${group.key}-${l.code}-${i}`} line={l} money={money} />
      ))}
      {group.lines.length > 1 && (
        <LineRow
          line={{
            code: '',
            name: `Total ${group.title.toLowerCase()}`,
            current: group.total.current,
            prior: group.total.prior,
            bold: true,
          }}
          money={money}
        />
      )}
    </>
  );
}

function LineRow({
  line,
  money,
}: {
  line: AfsLine;
  money: (n: number) => string;
}) {
  return (
    <tr className={line.bold ? 'border-t border-neutral-200' : ''}>
      <td
        className={`px-5 py-1.5 ${line.indent ? 'pl-8' : ''} ${
          line.bold ? 'font-bold' : 'text-neutral-700'
        }`}
      >
        {line.code ? (
          <span className="text-[11px] text-neutral-400 mr-2 tabular-nums">{line.code}</span>
        ) : null}
        {line.name}
      </td>
      <td
        className={`px-5 py-1.5 text-right tabular-nums ${line.bold ? 'font-bold' : ''}`}
      >
        {money(line.current)}
      </td>
      <td
        className={`px-5 py-1.5 text-right tabular-nums text-neutral-500 ${
          line.bold ? 'font-bold text-slate-800' : ''
        }`}
      >
        {money(line.prior)}
      </td>
    </tr>
  );
}
