'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fieldClass,
} from '@/components/hire/SimpleEntityForm';
import {
  BOOKING_STATUSES,
  HIRE_REQUIREMENT_LABELS,
  computeHireCommissions,
  getHireCategory,
  itemRequirements,
  type HireRequirementKey,
} from '@/lib/hire/hiregraph';
import {
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

export default function HireBookingsPage() {
  const { store, coreCustomers, loading, saving, post, summary } =
    useHiregraph();
  const [form, setForm] = useState({
    code: '',
    item_id: '',
    crm_customer_id: '',
    start_date: '',
    end_date: '',
    units: '1',
    qty: '1',
    status: 'requested',
    delivery_address: '',
    notes: '',
  });

  const preview = useMemo(() => {
    if (!store) return null;
    const item = store.items.find((i) => i.id === form.item_id);
    if (!item) return null;
    const units = Math.max(1, Number(form.units) || 1);
    const qty = Math.max(1, Number(form.qty) || 1);
    const rental = (Number(item.rate_zar) || 0) * units * qty;
    const cat = getHireCategory(item.category_id);
    const deposit =
      Number(item.deposit_zar) ||
      (cat?.defaultDepositPct
        ? Math.round((rental * cat.defaultDepositPct) / 100)
        : 0);
    const fees = computeHireCommissions({
      rentalZar: rental,
      depositZar: deposit,
    });
    const reqs = itemRequirements(item);
    const crmId = Number(form.crm_customer_id);
    const kycKey = Number.isFinite(crmId) && crmId > 0 ? String(crmId) : '';
    const met = new Set<HireRequirementKey>(
      kycKey ? store.customer_kyc?.[kycKey] || [] : []
    );
    const pending = reqs.filter((r) => !met.has(r));
    const customer = coreCustomers.find((c) => c.id === crmId);
    return { fees, pending, item, reqs, customer };
  }, [
    store,
    coreCustomers,
    form.item_id,
    form.crm_customer_id,
    form.units,
    form.qty,
  ]);

  const add = async () => {
    if (!form.code.trim() || !form.item_id || !form.crm_customer_id) {
      toast.error('Code, item and core customer required');
      return;
    }
    const crmId = Number(form.crm_customer_id);
    if (!Number.isFinite(crmId) || crmId <= 0) {
      toast.error('Select a customer from Core Customers');
      return;
    }
    const customer = coreCustomers.find((c) => c.id === crmId);
    const item = store?.items.find((i) => i.id === form.item_id);
    await post({
      entity: 'bookings',
      action: 'upsert',
      record: {
        code: form.code,
        item_id: form.item_id,
        crm_customer_id: crmId,
        customer_name: customer?.name || '',
        srm_supplier_id: item?.srm_supplier_id ?? null,
        supplier_name: item?.supplier_name || '',
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        units: Number(form.units) || 1,
        qty: Number(form.qty) || 1,
        delivery_address: form.delivery_address,
        notes: form.notes,
        status:
          preview && preview.pending.length
            ? 'awaiting_requirements'
            : form.status,
      },
    });
    toast.success('Booking saved (fees auto-calculated)');
    setForm((f) => ({
      ...f,
      code: '',
      start_date: '',
      end_date: '',
      notes: '',
      delivery_address: '',
    }));
  };

  return (
    <HiregraphWorkbench
      title="Bookings"
      titleAccent="hire requests"
      description={`Request hire dates against a Core Customers (CRM) renter. System quotes rental, ${HIRE_SUPPLIER_COMMISSION_PCT}% supplier fee, and deposit. Members pay no platform fee. Category requirements come from hire KYC.`}
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 dark:border-cyan-500/30 dark:bg-cyan-950/40">
            <p className="text-sm text-cyan-950 dark:text-cyan-50">
              <strong>Renter:</strong> pick from Core Customers — set hire KYC
              under Hire customers if needed.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/customers"
                className="inline-flex items-center gap-1 rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                Open Customers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/dashboard/hiregraph/customers"
                className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-white px-3 py-1.5 text-xs font-bold text-cyan-900 dark:border-cyan-400/40 dark:bg-cyan-900/40 dark:text-cyan-50"
              >
                Hire KYC
              </Link>
            </div>
          </div>

          <StatRow
            tone="hg-talent"
            items={[
              {
                label: 'Bookings',
                value: Number(summary?.bookingCount) || store.bookings.length,
              },
              { label: 'Open', value: Number(summary?.openBookings) || 0 },
              {
                label: 'Core customers',
                value: coreCustomers.length,
              },
            ]}
          />
          <FormCard
            title="New hire booking"
            tone="hg-talent"
            saving={saving}
            onSubmit={() => void add()}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Code
                <input
                  className={fieldClass()}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Status
                <select
                  className={fieldClass()}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {BOOKING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Item
                <select
                  className={fieldClass()}
                  value={form.item_id}
                  onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                >
                  <option value="">— select —</option>
                  {store.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} · {i.title}
                      {i.supplier_name ? ` (${i.supplier_name})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Customer (Core CRM)
                <select
                  className={fieldClass()}
                  value={form.crm_customer_id}
                  onChange={(e) =>
                    setForm({ ...form, crm_customer_id: e.target.value })
                  }
                >
                  <option value="">— select from Customers —</option>
                  {coreCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.email ? ` · ${c.email}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {coreCustomers.length === 0 ? (
                <p className="sm:col-span-2 text-[11px] text-amber-800 dark:text-amber-100">
                  No core customers yet.{' '}
                  <Link
                    href="/dashboard/customers"
                    className="font-bold underline"
                  >
                    Add one in Customers
                  </Link>{' '}
                  first.
                </p>
              ) : null}
              <label className="text-xs font-bold">
                Start
                <input
                  type="date"
                  className={fieldClass()}
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                End
                <input
                  type="date"
                  className={fieldClass()}
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Units (days/hours)
                <input
                  className={fieldClass()}
                  value={form.units}
                  onChange={(e) => setForm({ ...form, units: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Qty
                <input
                  className={fieldClass()}
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Delivery / site address
                <input
                  className={fieldClass()}
                  value={form.delivery_address}
                  onChange={(e) =>
                    setForm({ ...form, delivery_address: e.target.value })
                  }
                />
              </label>
            </div>
            {preview ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs dark:border-emerald-400/30 dark:bg-emerald-950/40">
                <p className="font-black text-emerald-950 dark:text-emerald-100">
                  Quote preview · members free
                  {preview.customer ? ` · ${preview.customer.name}` : ''}
                </p>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <span>
                    Rental:{' '}
                    <strong>
                      R{preview.fees.rentalZar.toLocaleString('en-ZA')}
                    </strong>
                  </span>
                  <span>
                    Deposit:{' '}
                    <strong>
                      R{preview.fees.depositZar.toLocaleString('en-ZA')}
                    </strong>
                  </span>
                  <span>
                    Supplier {HIRE_SUPPLIER_COMMISSION_PCT}%:{' '}
                    <strong>
                      R
                      {preview.fees.supplierCommissionZar.toLocaleString(
                        'en-ZA'
                      )}
                    </strong>
                  </span>
                  <span>
                    Customer (free):{' '}
                    <strong>
                      R
                      {preview.fees.customerCommissionZar.toLocaleString(
                        'en-ZA'
                      )}
                    </strong>
                  </span>
                  <span>
                    Supplier nets:{' '}
                    <strong>
                      R{preview.fees.supplierNetZar.toLocaleString('en-ZA')}
                    </strong>
                  </span>
                  <span>
                    Customer pays (incl. deposit):{' '}
                    <strong>
                      R{preview.fees.customerPaysZar.toLocaleString('en-ZA')}
                    </strong>
                  </span>
                </div>
                {preview.pending.length ? (
                  <p className="mt-2 text-amber-900 dark:text-amber-100">
                    Outstanding requirements:{' '}
                    {preview.pending
                      .map((r) => HIRE_REQUIREMENT_LABELS[r])
                      .join(', ')}
                  </p>
                ) : form.crm_customer_id ? (
                  <p className="mt-2 text-emerald-800 dark:text-emerald-200">
                    All category requirements met for this customer.
                  </p>
                ) : null}
              </div>
            ) : null}
          </FormCard>
          <DataTable
            tone="hg-talent"
            headers={['Code', 'Item', 'Customer', 'Status', 'Customer pays']}
            rows={store.bookings.map((b) => ({
              id: b.id,
              cells: [
                b.code,
                b.item_title || b.item_id,
                b.customer_name ||
                  (b.crm_customer_id
                    ? `CRM #${b.crm_customer_id}`
                    : b.customer_id) ||
                  '—',
                b.status || 'requested',
                b.customer_pays_zar != null
                  ? `R${Number(b.customer_pays_zar).toLocaleString('en-ZA')}`
                  : '—',
              ],
            }))}
            onDelete={async (id) => {
              await post({ entity: 'bookings', action: 'delete', id });
              toast.success('Booking removed');
            }}
          />
        </div>
      )}
    </HiregraphWorkbench>
  );
}
