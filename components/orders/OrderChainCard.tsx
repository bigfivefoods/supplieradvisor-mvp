'use client';

type Chain = {
  linkId: number;
  salesOrder?: {
    id?: number;
    number?: string | null;
    status?: string | null;
    customerName?: string | null;
    total?: number | null;
    productionLabel?: string | null;
    origin?: string | null;
  };
  purchaseOrder?: {
    id?: number;
    status?: string | null;
    supplierName?: string | null;
    total?: number | null;
    paymentStatus?: string | null;
    amountPaid?: number | null;
    productionStatus?: string | null;
  };
  commercial?: {
    revenue?: number;
    revenuePaid?: number;
    costCommitted?: number;
    costPaid?: number;
    margin?: number;
    currency?: string;
  };
  invoices?: Array<{ number?: string | null; status?: string | null; total?: number | null }>;
};

type Props = {
  chain: Chain;
  className?: string;
};

function money(n: number | null | undefined, ccy = 'ZAR') {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ccy}`;
}

export default function OrderChainCard({ chain, className = '' }: Props) {
  const ccy = chain.commercial?.currency || 'ZAR';
  const margin = chain.commercial?.margin;
  const marginPositive = margin != null && margin >= 0;

  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Linked chain
          </p>
          <h3 className="text-base font-bold text-slate-900">
            SO {chain.salesOrder?.number || `#${chain.salesOrder?.id}`}
            <span className="mx-2 text-slate-300">→</span>
            PO #{chain.purchaseOrder?.id}
          </h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            marginPositive
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          Margin {money(margin, ccy)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Customer (SO)</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {chain.salesOrder?.customerName || '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Status: {chain.salesOrder?.status || '—'} · Production:{' '}
            {chain.salesOrder?.productionLabel || '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Value: {money(chain.salesOrder?.total as number, ccy)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Manufacturer (PO)</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {chain.purchaseOrder?.supplierName || '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Status: {chain.purchaseOrder?.status || '—'} · Prod:{' '}
            {chain.purchaseOrder?.productionStatus || '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Payment: {chain.purchaseOrder?.paymentStatus || 'unpaid'} · Paid{' '}
            {money(chain.purchaseOrder?.amountPaid as number, ccy)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase text-slate-400">Revenue</p>
          <p className="text-sm font-semibold text-slate-800">
            {money(chain.commercial?.revenue, ccy)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400">Collected</p>
          <p className="text-sm font-semibold text-slate-800">
            {money(chain.commercial?.revenuePaid, ccy)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400">Cost committed</p>
          <p className="text-sm font-semibold text-slate-800">
            {money(chain.commercial?.costCommitted, ccy)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400">Cost paid</p>
          <p className="text-sm font-semibold text-slate-800">
            {money(chain.commercial?.costPaid, ccy)}
          </p>
        </div>
      </div>

      {chain.invoices && chain.invoices.length > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <p className="text-xs font-medium text-slate-500">Invoices</p>
          <ul className="mt-1 space-y-1">
            {chain.invoices.map((inv, i) => (
              <li key={i} className="text-xs text-slate-700">
                {inv.number || 'INV'} · {inv.status} · {money(inv.total as number, ccy)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
