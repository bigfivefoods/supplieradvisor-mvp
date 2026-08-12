'use client';

import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import { DataTable, StatRow } from '@/components/hire/SimpleEntityForm';
import {
  HIRE_COMMERCIAL_COPY,
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_PLATFORM_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

export default function HireSettlementsPage() {
  const { store, loading, summary } = useHiregraph();

  const rows = (store?.bookings || []).filter(
    (b) =>
      b.status === 'completed' ||
      b.status === 'returned' ||
      b.status === 'out' ||
      b.status === 'paid'
  );

  return (
    <HiregraphWorkbench
      title="Settlements"
      titleAccent="dual commission ledger"
      description={HIRE_COMMERCIAL_COPY.vsOtherAdvisors}
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 px-4 py-4 dark:border-emerald-400/30 dark:from-emerald-950 dark:via-[#0a1628] dark:to-cyan-950">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Commercial model
            </p>
            <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
              {HIRE_SUPPLIER_COMMISSION_PCT}% supplier +{' '}
              {HIRE_CUSTOMER_COMMISSION_PCT}% customer ={' '}
              {HIRE_PLATFORM_COMMISSION_PCT}% platform
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-emerald-50/80">
              {HIRE_COMMERCIAL_COPY.depositLine}.
            </p>
          </div>

          <StatRow
            tone="hg-client"
            items={[
              {
                label: 'Hire GMV',
                value: `R${Number(summary?.gmvZar || 0).toLocaleString('en-ZA')}`,
              },
              {
                label: `Supplier ${HIRE_SUPPLIER_COMMISSION_PCT}%`,
                value: `R${Number(summary?.supplierCommissionZar || 0).toLocaleString('en-ZA')}`,
              },
              {
                label: `Customer ${HIRE_CUSTOMER_COMMISSION_PCT}%`,
                value: `R${Number(summary?.customerCommissionZar || 0).toLocaleString('en-ZA')}`,
              },
              {
                label: 'Platform total',
                value: `R${Number(summary?.platformFeesZar || 0).toLocaleString('en-ZA')}`,
              },
            ]}
          />

          <DataTable
            tone="hg-client"
            headers={[
              'Code',
              'Item',
              'Rental R',
              'Supp. fee',
              'Cust. fee',
              'Platform',
              'Status',
            ]}
            rows={rows.map((b) => ({
              id: b.id,
              cells: [
                b.code,
                b.item_title || '—',
                b.rental_zar != null
                  ? Number(b.rental_zar).toLocaleString('en-ZA')
                  : '—',
                b.supplier_commission_zar != null
                  ? Number(b.supplier_commission_zar).toLocaleString('en-ZA')
                  : '—',
                b.customer_commission_zar != null
                  ? Number(b.customer_commission_zar).toLocaleString('en-ZA')
                  : '—',
                b.platform_total_zar != null
                  ? Number(b.platform_total_zar).toLocaleString('en-ZA')
                  : '—',
                b.status || '—',
              ],
            }))}
          />
        </div>
      )}
    </HiregraphWorkbench>
  );
}
