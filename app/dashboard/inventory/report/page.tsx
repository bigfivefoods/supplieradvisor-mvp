'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Download, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';
import type { InventoryReportPack } from '@/lib/inventory/report-types';

export default function InventoryReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [pack, setPack] = useState<InventoryReportPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/report?companyId=${companyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setPack(data.report || null);
    } catch (err) {
      setPack(null);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/inventory/report/pdf?companyId=${companyId}&download=1`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Could not build PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Inventory one-pager downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  const s = pack?.summary;
  const ccy = pack?.currency || 'ZAR';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      <InventoryHeader
        title="Inventory"
        titleAccent="report"
        description="Key stock metrics — on hand, value, cover, locations, lots, and 30-day movement. Download a one-page PDF for stand-ups and reviews."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={downloading || loading}
              onClick={() => void downloadPdf()}
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              One-pager PDF
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      {loading && !pack ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !pack || !s ? (
        <p className="text-sm text-neutral-500">No inventory data yet.</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-neutral-500">
            Snapshot {pack.asOf.slice(0, 16).replace('T', ' ')} UTC · {pack.companyName}
          </p>

          {(s.lowStockSkus > 0 || s.lotsExpired > 0 || s.lotsExpiring30 > 0) && (
            <div className="mb-6 flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Exceptions need attention</div>
                <div className="text-xs mt-1 opacity-90">
                  {s.lowStockSkus} SKU{s.lowStockSkus === 1 ? '' : 's'} at or below reorder
                  {s.outOfStockSkus ? ` · ${s.outOfStockSkus} at zero` : ''}
                  {s.lotsExpiring30 ? ` · ${s.lotsExpiring30} lot(s) expire within 30 days` : ''}
                  {s.lotsExpired ? ` · ${s.lotsExpired} expired` : ''}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <Kpi label="Units on hand" value={fmtQty(s.unitsOnHand)} sub={`${fmtQty(s.unitsAvailable)} available`} />
            <Kpi
              label="Value at cost"
              value={formatMoney(s.valueAtCost, ccy, { compact: false })}
              sub={`Sell ${formatMoney(s.valueAtSell, ccy, { compact: false })}`}
            />
            <Kpi
              label="SKUs with stock"
              value={String(s.skusWithStock)}
              sub={`${s.productsActive} active / ${s.products} catalog`}
            />
            <Kpi
              label="Low stock"
              value={String(s.lowStockSkus)}
              tone={s.lowStockSkus > 0 ? 'amber' : 'emerald'}
              sub={`${s.outOfStockSkus} at zero`}
            />
            <Kpi
              label="Network units"
              value={fmtQty(s.networkUnits)}
              sub={`${fmtQty(s.unitsInTransit)} transit · ${fmtQty(s.containerUnits)} outlet`}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <Kpi
              label="Cover days"
              value={s.coverDays != null ? String(Math.round(s.coverDays)) : '—'}
              sub={s.coverDays != null ? 'On hand / avg daily issues (30d)' : 'No issues in last 30 days'}
            />
            <Kpi label="Locations" value={String(s.warehouses)} sub={`${s.locationsWithStock} holding stock`} />
            <Kpi
              label="Lots"
              value={String(s.lots)}
              sub={`${s.lotsExpiring30} expiring · ${s.serials} serials`}
            />
            <Kpi
              label="30-day issues"
              value={fmtQty(s.issues30d)}
              sub={`${s.openTransfers} open transfer(s)`}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <Card title="Units by type">
              {pack.typeMix.map((t) => (
                <Row
                  key={t.key}
                  label={t.label}
                  value={fmtQty(t.units)}
                  extra={formatMoney(t.value_cost, ccy, { compact: false })}
                />
              ))}
            </Card>
            <Card title="Units by owner">
              {pack.ownerMix.map((t) => (
                <Row key={t.key} label={t.label} value={fmtQty(t.units)} />
              ))}
            </Card>
          </div>

          <Card title="Locations" className="mb-8" actionHref="/dashboard/inventory/warehouses" actionLabel="Locations">
            <Table
              headers={['Location', 'Units', 'Available', 'SKUs', 'Low', 'Inbound']}
              rows={pack.locations.map((l) => [
                `${l.name}${l.city ? ` · ${l.city}` : ''}`,
                fmtQty(l.units),
                fmtQty(l.available),
                String(l.skus),
                String(l.low_stock),
                fmtQty(l.in_transit_inbound),
              ])}
            />
          </Card>

          <Card title="Highest-value SKUs" className="mb-8" actionHref="/dashboard/inventory/stock" actionLabel="Live stock">
            <Table
              headers={['Product', 'SKU', 'Qty', 'Cost value', 'Sell value', 'Low']}
              rows={pack.topSkus.map((p) => [
                p.name,
                p.sku || '—',
                fmtQty(p.qty),
                formatMoney(p.value_cost, ccy, { compact: false }),
                formatMoney(p.value_sell, ccy, { compact: false }),
                p.is_low ? 'Yes' : '—',
              ])}
            />
          </Card>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <Card title="Low stock" actionHref="/dashboard/inventory/stock" actionLabel="Stock">
              {pack.lowStock.length === 0 ? (
                <p className="px-5 py-6 text-sm text-emerald-700">No SKUs at or below reorder.</p>
              ) : (
                <Table
                  headers={['Product', 'On hand', 'Reorder']}
                  rows={pack.lowStock.map((p) => [
                    p.name,
                    fmtQty(p.qty),
                    fmtQty(p.reorder_level),
                  ])}
                />
              )}
            </Card>
            <Card title="Expiring lots (30 days)" actionHref="/dashboard/inventory/lots" actionLabel="Lots">
              {pack.expiringLots.length === 0 ? (
                <p className="px-5 py-6 text-sm text-emerald-700">No lots expiring in the next 30 days.</p>
              ) : (
                <Table
                  headers={['Lot', 'Product', 'Expiry', 'Days']}
                  rows={pack.expiringLots.map((l) => [
                    l.lot_number,
                    l.product_name || '—',
                    l.expiry_date,
                    l.expired ? 'Expired' : String(l.days),
                  ])}
                />
              )}
            </Card>
          </div>

          <Card title="30-day movement pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-5">
              {(
                [
                  ['Receive', pack.movements30d.receive],
                  ['Issue', pack.movements30d.issue],
                  ['Transfer', pack.movements30d.transfer],
                  ['Adjustment', pack.movements30d.adjustment],
                  ['Count', pack.movements30d.count],
                  ['Total', pack.movements30d.total],
                ] as const
              ).map(([label, n]) => (
                <div key={label}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    {label}
                  </div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                    {fmtQty(n)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function fmtQty(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString('en-ZA');
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'amber' | 'emerald';
}) {
  return (
    <div className="rounded-3xl border border-neutral-100 bg-white px-4 py-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</div>
      <div
        className={`mt-1 text-xl font-black tabular-nums ${
          tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div> : null}
    </div>
  );
}

function Card({
  title,
  children,
  className = '',
  actionHref,
  actionLabel,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className={`rounded-3xl border border-neutral-100 bg-white overflow-hidden shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-slate-50/70 px-5 py-3">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {actionHref ? (
          <Link href={actionHref} className="text-xs font-bold text-[#00b4d8] hover:underline">
            {actionLabel} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 py-2.5 border-b border-neutral-50 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="text-sm tabular-nums font-semibold text-slate-900">
        {value}
        {extra ? <span className="ml-2 text-xs font-normal text-neutral-400">{extra}</span> : null}
      </span>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows.length) {
    return <p className="px-5 py-6 text-sm text-neutral-500">None.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-neutral-400">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 text-left font-semibold first:pl-5 last:pr-5 last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-neutral-50">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-4 py-2 ${j === 0 ? 'pl-5 font-medium text-slate-800' : 'tabular-nums text-slate-700'} ${
                    j === r.length - 1 ? 'pr-5 text-right' : ''
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
