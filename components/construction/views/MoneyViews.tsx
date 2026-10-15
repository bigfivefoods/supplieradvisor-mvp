'use client';

import { useState } from 'react';
import { BadgeDollarSign, FileCheck2, Receipt } from 'lucide-react';
import {
  ConstructionButton,
  ConstructionDrawer,
  ConstructionEmpty,
  ConstructionMoney,
  ConstructionMoneyBars,
  ConstructionPageHead,
  ConstructionStatusPill,
  ConstructionTable,
  ConstructionUnavailable,
  constructionField,
} from '@/components/construction/ConstructionUi';
import { ScreenState, type DeskProps } from '@/components/construction/desk';
import {
  newConstructionId,
  resolvePaymentStatus,
  type ConstructionCertificate,
  type ConstructionCost,
  type ConstructionProgressPayment,
} from '@/lib/construction/constructiongraph';
import { formatRand, sastToday } from '@/lib/construction/format';

function sumEntered(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => value != null && Number.isFinite(Number(value)));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + Number(value), 0);
}

function moneyHidden(props: DeskProps, key: 'payments' | 'certificates' | 'costs') {
  if (props.role === 'site_manager' || props.role === 'none') return true;
  return !Array.isArray(props.store[key]);
}

export function PaymentsView(props: DeskProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="payments" onRetry={props.handlers.retry} />;
  }
  if (moneyHidden(props, 'payments')) {
    return (
      <div className="space-y-4" data-testid="payments-view">
        <ConstructionPageHead title="Payments" badge={props.badge} detail="Progress claims stay with the office." />
        <ConstructionUnavailable testId="payments-unavailable" />
      </div>
    );
  }
  const rows = props.store.payments;
  const today = sastToday();
  return (
    <div className="space-y-4" data-testid="payments-view">
      <ConstructionPageHead
        title="Payments"
        badge={props.badge}
        detail="Amounts are shown as entered. This book does not calculate VAT."
        actions={
          props.role === 'owner' ? (
            <ConstructionButton data-testid="payment-add" onClick={() => setOpen(true)}>
              Add claim
            </ConstructionButton>
          ) : null
        }
      />
      {rows.length ? (
        <article className="rounded-3xl border border-sky-100 bg-sky-50 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0f172a]/70">Claims as entered</p>
          <div className="mt-3">
            <ConstructionMoneyBars
              rows={[
                { label: 'Claimed', value: sumEntered(rows.map((row) => row.claimed_amount)) },
                { label: 'Certified', value: sumEntered(rows.map((row) => row.certified_amount)) },
                { label: 'Paid', value: sumEntered(rows.map((row) => row.paid_amount)) },
              ]}
            />
          </div>
        </article>
      ) : null}
      {rows.length === 0 ? (
        <ConstructionEmpty
          testId="payments-empty"
          icon={<Receipt />}
          title="No payments yet"
          hint="Add a progress claim when the project has a payment plan."
        />
      ) : (
        <ConstructionTable
          testId="payments-table"
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { key: 'number', header: 'Number', render: (row) => row.number },
            { key: 'title', header: 'Title', render: (row) => row.title },
            { key: 'project', header: 'Project', render: (row) => props.store.sites.find((site) => site.id === row.site_id)?.code || '—' },
            { key: 'amount', header: 'As entered', render: (row) => <ConstructionMoney value={row.certified_amount ?? row.claimed_amount ?? row.planned_amount} /> },
            { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={resolvePaymentStatus(row, today)} /> },
            {
              key: 'act',
              header: '',
              render: (row) =>
                props.caps.canCertify && !row.paid_at ? (
                  <ConstructionButton
                    data-testid={`payment-certify-${row.id}`}
                    onClick={() => void props.handlers.run({ action: 'payment', paymentId: row.id, verb: row.certified_at ? 'pay' : 'certify' })}
                  >
                    {row.certified_at ? 'Record pay' : 'Certify'}
                  </ConstructionButton>
                ) : null,
            },
          ]}
        />
      )}
      <p className="text-xs text-slate-500">Retention on certify stays at 10% of the certified amount, as the book already does.</p>
      <ConstructionDrawer open={open} title="New claim" onClose={() => setOpen(false)} testId="payment-drawer">
        <label className="block text-xs font-bold text-slate-700">
          Title
          <input data-testid="payment-title" className={constructionField} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-bold text-slate-700">
          Amount as entered
          <input data-testid="payment-amount" className={constructionField} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <ConstructionButton
          className="mt-4"
          data-testid="payment-save"
          onClick={() => {
            if (!title.trim()) return;
            const row: ConstructionProgressPayment = {
              id: newConstructionId('pay'),
              site_id: props.store.sites[0]?.id,
              number: `PP-${String(rows.length + 1).padStart(2, '0')}`,
              title: title.trim(),
              planned_amount: Number(amount) || 0,
              status: 'planned',
            };
            void props.handlers.merge({ payments: [row] });
            setOpen(false);
          }}
        >
          Save claim
        </ConstructionButton>
      </ConstructionDrawer>
    </div>
  );
}

export function CertificatesView(props: DeskProps) {
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="certificates" onRetry={props.handlers.retry} />;
  }
  if (moneyHidden(props, 'certificates') || !props.caps.canSeeMoney) {
    return (
      <div className="space-y-4" data-testid="certificates-view">
        <ConstructionPageHead title="Certificates" badge={props.badge} detail="Interim payment certificates stay with the office." />
        <ConstructionUnavailable testId="certificates-unavailable" />
      </div>
    );
  }
  const rows = props.store.certificates;
  return (
    <div className="space-y-4" data-testid="certificates-view">
      <ConstructionPageHead title="Certificates" badge={props.badge} detail="Issued from a certified claim. Amounts are as entered, with the stored retention." />
      {rows.length === 0 ? (
        <ConstructionEmpty testId="certificates-empty" icon={<FileCheck2 />} title="No certificates yet" hint="Certify a progress claim to issue an interim payment certificate." />
      ) : (
        <ConstructionTable
          testId="certificates-table"
          rows={rows}
          rowKey={(row: ConstructionCertificate) => row.id}
          columns={[
            { key: 'number', header: 'Number', render: (row) => row.number },
            { key: 'period', header: 'Period', render: (row) => row.period || '—' },
            { key: 'certified', header: 'Certified', render: (row) => <ConstructionMoney value={row.certified_amount} /> },
            { key: 'retention', header: 'Retention', render: (row) => <ConstructionMoney value={row.retention} /> },
            { key: 'status', header: 'Status', render: (row) => <ConstructionStatusPill status={row.status} /> },
          ]}
        />
      )}
    </div>
  );
}

export function CostsView(props: DeskProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  if (props.state === 'loading' || props.state === 'error') {
    return <ScreenState state={props.state} testId="costs" onRetry={props.handlers.retry} />;
  }
  if (moneyHidden(props, 'costs') || !props.caps.canSeeCostsAndBoq) {
    return (
      <div className="space-y-4" data-testid="costs-view">
        <ConstructionPageHead title="Costs" badge={props.badge} detail="Actuals and margin stay with the office." />
        <ConstructionUnavailable testId="costs-unavailable" />
      </div>
    );
  }
  const rows = props.store.costs;
  return (
    <div className="space-y-4" data-testid="costs-view">
      <ConstructionPageHead
        title="Costs"
        badge={props.badge}
        detail="Actuals allocated to a project. Amounts are as entered."
        actions={
          props.role === 'owner' ? (
            <ConstructionButton data-testid="cost-add" onClick={() => setOpen(true)}>
              Add cost
            </ConstructionButton>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <ConstructionEmpty testId="costs-empty" icon={<BadgeDollarSign />} title="No costs yet" hint="Post an actual when the site or the office has a figure." />
      ) : (
        <ConstructionTable
          testId="costs-table"
          rows={rows}
          rowKey={(row: ConstructionCost) => row.id}
          columns={[
            { key: 'description', header: 'Description', render: (row) => row.description },
            { key: 'kind', header: 'Kind', render: (row) => row.kind },
            { key: 'amount', header: 'As entered', render: (row) => formatRand(row.amount) },
            { key: 'project', header: 'Project', render: (row) => props.store.sites.find((site) => site.id === row.site_id)?.code || '—' },
          ]}
        />
      )}
      <ConstructionDrawer open={open} title="Add cost" onClose={() => setOpen(false)} testId="cost-drawer">
        <label className="block text-xs font-bold text-slate-700">
          Description
          <input data-testid="cost-description" className={constructionField} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-bold text-slate-700">
          Amount as entered
          <input data-testid="cost-amount" className={constructionField} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <ConstructionButton
          className="mt-4"
          data-testid="cost-save"
          onClick={() => {
            if (!description.trim()) return;
            const row: ConstructionCost = {
              id: newConstructionId('cost'),
              site_id: props.store.sites[0]?.id,
              kind: 'other',
              description: description.trim(),
              amount: Number(amount) || 0,
              date: sastToday(),
            };
            void props.handlers.merge({ costs: [row] });
            setOpen(false);
          }}
        >
          Save cost
        </ConstructionButton>
      </ConstructionDrawer>
    </div>
  );
}
