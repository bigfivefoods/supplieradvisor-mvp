'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Minus,
  X,
  FileSpreadsheet,
  BookOpen,
  Building2,
  Sparkles,
} from 'lucide-react';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';

type Cell = 'yes' | 'partial' | 'no' | 'strong';

type Row = {
  capability: string;
  hint?: string;
  excel: Cell;
  xero: Cell;
  erp: Cell;
  sa: Cell;
};

const ROWS: Row[] = [
  {
    capability: 'Live verified trading network',
    hint: 'Invite, connect, score counterparties',
    excel: 'no',
    xero: 'no',
    erp: 'partial',
    sa: 'strong',
  },
  {
    capability: 'B2B + B2G + B2C on one fabric',
    excel: 'no',
    xero: 'no',
    erp: 'partial',
    sa: 'strong',
  },
  {
    capability: 'Supplier POs, OTIFEF & peer ratings',
    excel: 'partial',
    xero: 'no',
    erp: 'yes',
    sa: 'strong',
  },
  {
    capability: 'CRM: quotes → orders → AR',
    excel: 'partial',
    xero: 'partial',
    erp: 'yes',
    sa: 'strong',
  },
  {
    capability: 'Inventory, lots & QA holds that stop ship',
    excel: 'partial',
    xero: 'no',
    erp: 'yes',
    sa: 'strong',
  },
  {
    capability: 'Manufacturing: BOM / MPS / MRP / cells',
    excel: 'partial',
    xero: 'no',
    erp: 'yes',
    sa: 'strong',
  },
  {
    capability: 'Distribution & live shipment tracking',
    excel: 'no',
    xero: 'no',
    erp: 'yes',
    sa: 'strong',
  },
  {
    capability: 'Full GL / bank / VAT / management accounts',
    excel: 'partial',
    xero: 'strong',
    erp: 'strong',
    sa: 'yes',
  },
  {
    capability: 'Cost allocation to BU · cell · asset · BS',
    excel: 'partial',
    xero: 'partial',
    erp: 'yes',
    sa: 'strong',
  },
  {
    capability: 'People / HR · payroll · organogram',
    excel: 'partial',
    xero: 'no',
    erp: 'yes',
    sa: 'strong',
  },
  {
    capability: 'SHEQ · HACCP · NCR/CAPA as live controls',
    excel: 'no',
    xero: 'no',
    erp: 'partial',
    sa: 'strong',
  },
  {
    capability: 'Container last-mile & impact (jobs / meals)',
    excel: 'no',
    xero: 'no',
    erp: 'no',
    sa: 'strong',
  },
  {
    capability: 'On-chain passports & optional PO escrow',
    excel: 'no',
    xero: 'no',
    erp: 'partial',
    sa: 'strong',
  },
  {
    capability: 'Go-live in days (not 12–24 months)',
    excel: 'yes',
    xero: 'yes',
    erp: 'no',
    sa: 'strong',
  },
  {
    capability: 'Transparent ZAR SaaS (no 7-figure licence)',
    excel: 'yes',
    xero: 'yes',
    erp: 'no',
    sa: 'strong',
  },
  {
    capability: 'Africa-ready verification & Paystack billing',
    excel: 'partial',
    xero: 'partial',
    erp: 'partial',
    sa: 'strong',
  },
];

const COLS = [
  {
    key: 'excel' as const,
    name: 'Excel / Sheets',
    sub: 'Spreadsheets',
    icon: FileSpreadsheet,
    tone: 'slate',
  },
  {
    key: 'xero' as const,
    name: 'Xero-class',
    sub: 'Accounting cloud',
    icon: BookOpen,
    tone: 'sky',
  },
  {
    key: 'erp' as const,
    name: 'Major ERP',
    sub: 'SAP · Oracle · Dynamics',
    icon: Building2,
    tone: 'violet',
  },
  {
    key: 'sa' as const,
    name: 'SupplierAdvisor®',
    sub: 'Supply-chain OS',
    icon: Sparkles,
    tone: 'cyan',
    highlight: true,
  },
];

function CellMark({ value }: { value: Cell }) {
  if (value === 'strong') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-200">
        <Check className="h-4 w-4 stroke-[3]" aria-label="Best-in-class" />
      </span>
    );
  }
  if (value === 'yes') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-4 w-4" aria-label="Yes" />
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-100">
        <Minus className="h-4 w-4" aria-label="Partial" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
      <X className="h-3.5 w-3.5" aria-label="No" />
    </span>
  );
}

export default function ComparePlatforms() {
  return (
    <section
      id="compare"
      className="scroll-mt-20 border-t border-slate-200 bg-white py-20 sm:py-28"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-14">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
            Compare
          </p>
          <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
            Excel. Xero. Enterprise ERP.
            <span className="mt-2 block text-[#00b4d8]">
              Or the operating system they never became.
            </span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
            Spreadsheets fragment truth. Accounting clouds stop at the books.
            Major ERPs take years and seven figures. SupplierAdvisor® is the
            supply-chain OS — network, ops, finance, quality, people, and trust —
            live in days at SaaS economics.
          </p>
        </div>

        {/* Positioning cards */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              name: 'Excel / Sheets',
              who: 'Flexible but fragile',
              body: 'Everyone can edit. Nobody owns a single source of truth. No network, no holds, no OTIFEF.',
              icon: FileSpreadsheet,
            },
            {
              name: 'Xero-class accounting',
              who: 'Brilliant for books',
              body: 'World-class ledgers and bank feeds — but not a full supply-chain, SHEQ, or trading graph.',
              icon: BookOpen,
            },
            {
              name: 'Major ERP',
              who: 'Power at a price',
              body: 'SAP, Oracle, Dynamics — deep modules, 12–24 month projects, enterprise licence gravity.',
              icon: Building2,
            },
            {
              name: 'SupplierAdvisor®',
              who: 'The supply-chain OS',
              body: `Fourteen systems + verified network. ${COMPANY_TRIAL_DAYS}-day trial. From R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo. Built for African trade with global discipline.`,
              icon: Sparkles,
              highlight: true,
            },
          ].map((c) => (
            <div
              key={c.name}
              className={`rounded-3xl border p-5 sm:p-6 transition-all ${
                c.highlight
                  ? 'border-[#00b4d8]/50 bg-gradient-to-b from-sky-50 to-white shadow-md shadow-sky-100/80 ring-1 ring-[#00b4d8]/20'
                  : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
              }`}
            >
              <c.icon
                className={`mb-3 h-5 w-5 ${c.highlight ? 'text-[#00b4d8]' : 'text-slate-400'}`}
              />
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {c.who}
              </div>
              <h3 className="mt-1 text-lg font-black text-slate-900">{c.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.body}</p>
            </div>
          ))}
        </div>

        {/* Comparison matrix */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:px-5">
                    Capability
                  </th>
                  {COLS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-4 text-center sm:px-4 ${
                        col.highlight
                          ? 'bg-sky-50/90 text-[#0077b6]'
                          : 'text-slate-700'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <col.icon
                          className={`h-4 w-4 ${col.highlight ? 'text-[#00b4d8]' : 'text-slate-400'}`}
                        />
                        <span className="text-[12px] font-black leading-tight sm:text-[13px]">
                          {col.name}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {col.sub}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr
                    key={row.capability}
                    className={`border-b border-slate-100 ${
                      i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3.5 sm:px-5">
                      <div className="font-semibold text-slate-900">
                        {row.capability}
                      </div>
                      {row.hint && (
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {row.hint}
                        </div>
                      )}
                    </td>
                    {COLS.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-3.5 text-center sm:px-4 ${
                          col.highlight ? 'bg-sky-50/50' : ''
                        }`}
                      >
                        <div className="flex justify-center">
                          <CellMark value={row[col.key]} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-3 w-3" />
                </span>
                Best-in-class
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-3 w-3" />
                </span>
                Covered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-amber-700">
                  <Minus className="h-3 w-3" />
                </span>
                Partial / bolt-on
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <X className="h-3 w-3" />
                </span>
                Not designed for this
              </span>
            </div>
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0099b8]"
            >
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-[12px] leading-relaxed text-slate-400">
          Comparison is illustrative of typical capability classes (spreadsheets,
          cloud accounting, enterprise ERP suites). Individual products and
          add-ons vary. SupplierAdvisor® is a unified operating system — not a
          spreadsheet, not accounting-only, and not a multi-year ERP programme.
        </p>
      </div>
    </section>
  );
}
