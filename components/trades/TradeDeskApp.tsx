'use client';

import type { ReactNode } from 'react';
import { TradeBookProvider, useTradeBook } from '@/components/trades/TradeBook';
import { TradeHero, TradeLoading, tradeBtn, tradeCard, tradeKickerClass } from '@/components/trades/TradeUi';
import {
  QuoteSheet,
  TradeBoard,
  TradeCalendar,
  TradeCommand,
  TradeCustomers,
  TradeGantt,
  TradeInvoices,
  TradeMaterials,
  TradeNav,
  TradeQuoteBuilder,
  TradeReports,
  TradeTeam,
} from '@/components/trades/TradeScreens';
import {
  TradeArrival,
  TradeCompliance,
  TradeMessages,
  TradeNotices,
  TradeReviews,
  TradeSites,
  TradeTasks,
  TradeWebsite,
} from '@/components/trades/TradeMore';
import { formatZar } from '@/lib/trades/tradegraph';

export function TradeDeskApp({
  live = false,
  base,
  view,
  jobId = '',
  quoteId = '',
  invoiceId = '',
  payRef = '',
  startNew = false,
  heading,
}: {
  live?: boolean;
  base: string;
  view: string;
  jobId?: string;
  quoteId?: string;
  invoiceId?: string;
  payRef?: string;
  startNew?: boolean;
  heading?: ReactNode;
}) {
  return (
    <TradeBookProvider live={live}>
      <DeskBody
        base={base}
        view={view}
        jobId={jobId}
        quoteId={quoteId}
        invoiceId={invoiceId}
        payRef={payRef}
        startNew={startNew}
        heading={heading}
      />
    </TradeBookProvider>
  );
}

function DeskBody({
  base,
  view,
  jobId,
  quoteId,
  invoiceId,
  payRef,
  startNew,
  heading,
}: {
  base: string;
  view: string;
  jobId: string;
  quoteId: string;
  invoiceId: string;
  payRef: string;
  startNew: boolean;
  heading?: ReactNode;
}) {
  const { book, ready } = useTradeBook();
  return (
    <main className="min-h-dvh bg-gradient-to-b from-sky-50 to-slate-50 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className={tradeKickerClass}>TradeAdvisor®</p>
            <h1 className="truncate text-2xl font-black tracking-tight text-slate-900">{book.store.settings.brand_name}</h1>
            <p className="truncate text-sm text-slate-600">{book.store.settings.city} · {book.store.settings.phone}</p>
          </div>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#00b4d8] text-lg font-black text-[#0f172a] shadow-sm"
            aria-hidden
          >
            {(book.store.settings.brand_name || 'T').slice(0, 1).toUpperCase()}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-5">
        {view === 'sheet' || view === 'pay' ? null : <TradeNav base={base} />}
        {!ready ? <TradeLoading /> : <View base={base} view={view} quoteId={quoteId} jobId={jobId} invoiceId={invoiceId} payRef={payRef} startNew={startNew} heading={heading} />}
      </div>
    </main>
  );
}

function View({
  base,
  view,
  quoteId,
  jobId,
  invoiceId,
  payRef,
  startNew,
  heading,
}: {
  base: string;
  view: string;
  quoteId: string;
  jobId: string;
  invoiceId: string;
  payRef: string;
  startNew: boolean;
  heading?: ReactNode;
}) {
  if (view === 'board' || view === 'jobs') return <TradeBoard base={base} startNew={startNew} />;
  if (view === 'quote') return <TradeQuoteBuilder base={base} />;
  if (view === 'gantt') return <TradeGantt jobId={jobId || undefined} heading={heading} />;
  if (view === 'calendar' || view === 'schedule') return <TradeCalendar />;
  if (view === 'invoices') return <TradeInvoices />;
  if (view === 'customers') return <TradeCustomers />;
  if (view === 'materials') return <TradeMaterials />;
  if (view === 'team') return <TradeTeam />;
  if (view === 'reports') return <TradeReports />;
  if (view === 'tasks') return <TradeTasks />;
  if (view === 'messages') return <TradeMessages />;
  if (view === 'sites') return <TradeSites />;
  if (view === 'reviews') return <TradeReviews />;
  if (view === 'notices') return <TradeNotices />;
  if (view === 'compliance') return <TradeCompliance />;
  if (view === 'arrival') return <TradeArrival />;
  if (view === 'website') return <TradeWebsite base={base} />;
  if (view === 'sheet' || view === 'quote-sheet') return <QuoteSheet quoteId={quoteId} />;
  if (view === 'pay') return <PayLink invoiceId={invoiceId} payRef={payRef} />;
  return <TradeCommand base={base} />;
}

function PayLink({ invoiceId, payRef }: { invoiceId: string; payRef: string }) {
  const { book } = useTradeBook();
  const invoice = book.store.invoices.find((row) => row.id === invoiceId) || book.store.invoices.find((row) => `tg_${row.number.replace(/\W/g, '')}` === payRef);
  const meta = invoice ? book.desk.invoice_meta.find((row) => row.invoice_id === invoice.id) : null;
  const reference = payRef || meta?.pay_reference || '';
  return (
    <article className="mx-auto max-w-md space-y-3" data-testid="pay-page">
      <TradeHero
        kicker="Paystack"
        title={invoice ? invoice.number : 'Invoice'}
        detail="South African rand, VAT included."
      >
        <p className="text-3xl font-black tabular-nums" data-testid="pay-amount">{invoice ? formatZar(invoice.total_cents) : 'Amount on the invoice'}</p>
      </TradeHero>
      <div className={`${tradeCard} space-y-3 p-5`}>
        <p className="text-sm text-slate-700">Reference <strong data-testid="pay-ref">{reference || 'pending'}</strong></p>
        <p className="text-sm leading-relaxed text-slate-600">
          This page is the pay link. A live book with a Paystack secret opens Paystack checkout. The sample book shows the amount and reference and does not charge a card.
        </p>
        <a className={tradeBtn} href={meta?.pay_url || '#pay'}>
          Continue
        </a>
      </div>
    </article>
  );
}

export function TradePageFallback({ children }: { children?: ReactNode }) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-sky-50 to-slate-50 p-8">
      <TradeLoading label={typeof children === 'string' ? children : 'Opening TradeAdvisor®…'} />
    </main>
  );
}
