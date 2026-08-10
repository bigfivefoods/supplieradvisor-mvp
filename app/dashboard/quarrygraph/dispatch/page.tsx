'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  QuarrygraphWorkbench,
  useQuarrygraph,
} from '@/components/quarry/QuarrygraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fieldClass,
} from '@/components/quarry/SimpleEntityForm';

export default function QuarryDispatchPage() {
  const { store, loading, saving, post, summary } = useQuarrygraph();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    ticket_no: '',
    site_id: '',
    product_id: '',
    stockpile_id: '',
    customer: '',
    vehicle_reg: '',
    net_tonnes: '',
    destination: '',
    order_ref: '',
    status: 'dispatched',
  });

  const add = async () => {
    if (!(Number(form.net_tonnes) > 0)) {
      toast.error('Net tonnes required');
      return;
    }
    await post({
      entity: 'dispatches',
      action: 'upsert',
      record: {
        ...form,
        site_id: form.site_id || null,
        product_id: form.product_id || null,
        stockpile_id: form.stockpile_id || null,
        net_tonnes: Number(form.net_tonnes),
      },
    });
    toast.success('Dispatch ticket saved (stockpile deducted if linked)');
    setForm((f) => ({
      ...f,
      ticket_no: '',
      net_tonnes: '',
      vehicle_reg: '',
    }));
  };

  return (
    <QuarrygraphWorkbench
      title="Weighbridge dispatch"
      titleAccent="tickets"
      description="Weighbridge tickets with customer, vehicle and destination. Linking a stockpile deducts net tonnes from pad balance."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="qg-trade"
            items={[
              {
                label: 'Tickets',
                value: Number(summary?.dispatches) || store.dispatches.length,
              },
              {
                label: 'Dispatched t',
                value: Number(summary?.dispatchedTonnes) || 0,
              },
              {
                label: 'Stock left t',
                value: Number(summary?.stockpileTonnes) || 0,
              },
            ]}
          />
          <FormCard tone="qg-trade" title="New ticket" onSubmit={() => void add()} saving={saving} submitLabel="Save ticket">
            <input className={fieldClass()} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            <input className={fieldClass()} placeholder="Ticket no." value={form.ticket_no} onChange={(e) => setForm((f) => ({ ...f, ticket_no: e.target.value }))} />
            <select className={fieldClass()} value={form.site_id} onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}>
              <option value="">Site…</option>
              {store.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
            <select className={fieldClass()} value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}>
              <option value="">Product…</option>
              {store.products.map((p) => (
                <option key={p.id} value={p.id}>{p.code}</option>
              ))}
            </select>
            <select className={fieldClass()} value={form.stockpile_id} onChange={(e) => setForm((f) => ({ ...f, stockpile_id: e.target.value }))}>
              <option value="">Stockpile (optional)…</option>
              {store.stockpiles.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.tonnes} t)</option>
              ))}
            </select>
            <input className={fieldClass()} placeholder="Customer" value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} />
            <input className={fieldClass()} placeholder="Vehicle reg" value={form.vehicle_reg} onChange={(e) => setForm((f) => ({ ...f, vehicle_reg: e.target.value }))} />
            <input className={fieldClass()} type="number" step="0.01" placeholder="Net tonnes" value={form.net_tonnes} onChange={(e) => setForm((f) => ({ ...f, net_tonnes: e.target.value }))} />
            <input className={fieldClass()} placeholder="Destination" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
            <input className={fieldClass()} placeholder="Order ref" value={form.order_ref} onChange={(e) => setForm((f) => ({ ...f, order_ref: e.target.value }))} />
            <select className={fieldClass()} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="weighed">Weighed</option>
              <option value="dispatched">Dispatched</option>
              <option value="delivered">Delivered</option>
              <option value="void">Void</option>
            </select>
          </FormCard>
          <DataTable tone="qg-trade"
            headers={['Date', 'Ticket', 'Product', 'Customer', 'Reg', 'Net t', 'Destination', 'Status']}
            rows={[...store.dispatches]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((d) => {
                const prod = store.products.find((p) => p.id === d.product_id);
                return {
                  id: d.id,
                  cells: [
                    d.date,
                    d.ticket_no || '—',
                    prod?.code || '—',
                    d.customer || '—',
                    d.vehicle_reg || '—',
                    d.net_tonnes,
                    d.destination || '—',
                    d.status,
                  ],
                };
              })}
            onDelete={(id) => void post({ entity: 'dispatches', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
