'use client';

import { useState } from 'react';
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

export default function HireHandoverPage() {
  const { store, loading, saving, post, summary } = useHiregraph();
  const [form, setForm] = useState({
    booking_id: '',
    type: 'out',
    at: '',
    condition_notes: '',
    signed_by: '',
    damage_zar: '',
    deposit_released: false,
    close_rental: false,
  });

  const driverChips = Array.from(
    new Set(
      (store?.handovers || [])
        .map((h) => String(h.signed_by || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 8);

  const add = async () => {
    if (!form.booking_id) {
      toast.error('Select a booking');
      return;
    }
    const booking = store?.bookings.find((b) => b.id === form.booking_id);
    await post({
      entity: 'handovers',
      action: 'upsert',
      record: {
        booking_id: form.booking_id,
        type: form.type,
        condition_notes: form.condition_notes,
        signed_by: form.signed_by,
        deposit_released: form.deposit_released,
        booking_code: booking?.code || '',
        at: form.at || new Date().toISOString(),
        damage_zar: form.damage_zar ? Number(form.damage_zar) : null,
      },
    });
    if (booking) {
      const nextStatus =
        form.type === 'out'
          ? 'out'
          : form.type === 'return'
            ? form.close_rental
              ? 'completed'
              : 'returned'
            : booking.status;
      await post({
        entity: 'bookings',
        action: 'upsert',
        record: {
          ...booking,
          status: nextStatus,
        },
      });
    }
    toast.success(
      form.close_rental && form.type === 'return'
        ? 'Return recorded — rental closed'
        : 'Handover recorded'
    );
    setForm((f) => ({
      ...f,
      condition_notes: '',
      signed_by: '',
      damage_zar: '',
      deposit_released: false,
      close_rental: false,
    }));
  };

  return (
    <HiregraphWorkbench
      title="Handover"
      titleAccent="out & return"
      description="Condition notes when gear leaves and returns. Damage can hit the deposit; deposit release is never commissionable."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="hg-desk"
            items={[
              {
                label: 'Handovers',
                value: Number(summary?.handoverCount) || store.handovers.length,
              },
              { label: 'Out now', value: Number(summary?.outNow) || 0 },
              {
                label: 'Completed',
                value: Number(summary?.completedBookings) || 0,
              },
            ]}
          />
          <FormCard
            title="Record handover"
            tone="hg-desk"
            saving={saving}
            onSubmit={() => void add()}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold sm:col-span-2">
                Booking
                <select
                  className={fieldClass()}
                  value={form.booking_id}
                  onChange={(e) =>
                    setForm({ ...form, booking_id: e.target.value })
                  }
                >
                  <option value="">— select —</option>
                  {store.bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.item_title} · {b.customer_name} ({b.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Type
                <select
                  className={fieldClass()}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="out">OUT — customer collects / delivery</option>
                  <option value="return">RETURN — gear back</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                When
                <input
                  type="datetime-local"
                  className={fieldClass()}
                  value={form.at}
                  onChange={(e) => setForm({ ...form, at: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Driver / signed by
                <input
                  className={fieldClass()}
                  value={form.signed_by}
                  onChange={(e) =>
                    setForm({ ...form, signed_by: e.target.value })
                  }
                  placeholder="Name on the run sheet"
                />
              </label>
              {driverChips.length ? (
                <div className="flex flex-wrap gap-1.5 sm:col-span-2">
                  {driverChips.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        form.signed_by === name
                          ? 'bg-cyan-700 text-white'
                          : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                      onClick={() =>
                        setForm({
                          ...form,
                          signed_by: form.signed_by === name ? '' : name,
                        })
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="text-xs font-bold">
                Damage (R)
                <input
                  className={fieldClass()}
                  value={form.damage_zar}
                  onChange={(e) =>
                    setForm({ ...form, damage_zar: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Condition notes
                <input
                  className={fieldClass()}
                  value={form.condition_notes}
                  onChange={(e) =>
                    setForm({ ...form, condition_notes: e.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.deposit_released}
                  onChange={(e) =>
                    setForm({ ...form, deposit_released: e.target.checked })
                  }
                />
                Release refundable deposit (not commissionable)
              </label>
              {form.type === 'return' ? (
                <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.close_rental}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        close_rental: e.target.checked,
                        deposit_released:
                          e.target.checked || form.deposit_released,
                      })
                    }
                  />
                  Close rental — mark completed after this return
                </label>
              ) : null}
            </div>
          </FormCard>
          <DataTable
            tone="hg-desk"
            headers={['Type', 'Booking', 'When', 'Signed', 'Damage R']}
            rows={store.handovers.map((h) => ({
              id: h.id,
              cells: [
                h.type,
                h.booking_code || h.booking_id,
                h.at || '—',
                h.signed_by || '—',
                h.damage_zar ?? '—',
              ],
            }))}
            onDelete={async (id) => {
              await post({ entity: 'handovers', action: 'delete', id });
              toast.success('Handover removed');
            }}
          />
        </div>
      )}
    </HiregraphWorkbench>
  );
}
