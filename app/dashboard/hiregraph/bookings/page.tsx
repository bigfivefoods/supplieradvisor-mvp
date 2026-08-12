'use client';

import { useMemo, useState } from 'react';
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
} from '@/lib/hire/hiregraph';
import {
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

export default function HireBookingsPage() {
  const { store, loading, saving, post, summary } = useHiregraph();
  const [form, setForm] = useState({
    code: '',
    item_id: '',
    customer_id: '',
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
    const fees = computeHireCommissions({ rentalZar: rental, depositZar: deposit });
    const reqs = itemRequirements(item);
    const customer = store.customers.find((c) => c.id === form.customer_id);
    const met = new Set(customer?.requirements_met || []);
    const pending = reqs.filter((r) => !met.has(r));
    return { fees, pending, item, reqs };
  }, [store, form.item_id, form.customer_id, form.units, form.qty]);

  const add = async () => {
    if (!form.code.trim() || !form.item_id || !form.customer_id) {
      toast.error('Code, item and customer required');
      return;
    }
    await post({
      entity: 'bookings',
      action: 'upsert',
      record: {
        ...form,
        units: Number(form.units) || 1,
        qty: Number(form.qty) || 1,
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
      description={`Request hire dates. System quotes rental, ${HIRE_SUPPLIER_COMMISSION_PCT}% supplier fee, ${HIRE_CUSTOMER_COMMISSION_PCT}% customer fee, and deposit — and lists outstanding category requirements.`}
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="hg-talent"
            items={[
              {
                label: 'Bookings',
                value: Number(summary?.bookingCount) || store.bookings.length,
              },
              { label: 'Open', value: Number(summary?.openBookings) || 0 },
              { label: 'Out now', value: Number(summary?.outNow) || 0 },
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
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Customer (person)
                <select
                  className={fieldClass()}
                  value={form.customer_id}
                  onChange={(e) =>
                    setForm({ ...form, customer_id: e.target.value })
                  }
                >
                  <option value="">— select —</option>
                  {store.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.full_name}
                    </option>
                  ))}
                </select>
              </label>
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
                  Quote preview · dual commission
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
                      R{preview.fees.supplierCommissionZar.toLocaleString('en-ZA')}
                    </strong>
                  </span>
                  <span>
                    Customer {HIRE_CUSTOMER_COMMISSION_PCT}%:{' '}
                    <strong>
                      R{preview.fees.customerCommissionZar.toLocaleString('en-ZA')}
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
                ) : (
                  <p className="mt-2 text-emerald-800 dark:text-emerald-200">
                    All category requirements met for this customer.
                  </p>
                )}
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
                b.customer_name || b.customer_id,
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
