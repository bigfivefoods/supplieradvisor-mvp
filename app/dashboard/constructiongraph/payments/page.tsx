'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructionProjectSelect,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';
import {
  addDaysIso,
  applyPaymentAction,
  newConstructionId,
  paymentCashflow,
  projectReport,
  resolvePaymentStatus,
} from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphPaymentsPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [siteId, setSiteId] = useState('');
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [claimDate, setClaimDate] = useState('');
  const [payDate, setPayDate] = useState('');

  const add = async () => {
    const nextNo = number.trim();
    const nextTitle = title.trim();
    const planned = Number(amount);
    if (!siteId || !nextNo || !nextTitle || !Number.isFinite(planned)) {
      toast.error('Project, number, title and planned amount are required');
      return;
    }
    const plannedClaim = claimDate || new Date().toISOString().slice(0, 10);
    const plannedPay = payDate || addDaysIso(plannedClaim, 21);
    await post({
      action: 'merge',
      store: {
        payments: [
          {
            id: newConstructionId('pay'),
            site_id: siteId,
            number: nextNo,
            title: nextTitle,
            planned_amount: planned,
            planned_claim_date: plannedClaim,
            planned_pay_date: plannedPay,
            status: 'planned',
          },
        ],
      },
    });
    setNumber('');
    setTitle('');
    setAmount('');
    setClaimDate('');
    setPayDate('');
    toast.success('Progress payment dated on the project plan');
  };

  const run = async (id: string, action: 'claim' | 'certify' | 'pay') => {
    if (!store) return;
    const result = applyPaymentAction(store, {
      paymentId: id,
      action,
      actor: 'staff',
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const payment = result.store.payments.find((p) => p.id === id);
    await post({
      action: 'merge',
      store: {
        payments: payment ? [payment] : [],
        certificates: payment?.certificate_id
          ? result.store.certificates.filter((c) => c.id === payment.certificate_id)
          : [],
      },
    });
    toast.success(
      action === 'claim'
        ? 'Claim issued to the client'
        : action === 'certify'
          ? 'Certified — IPC on the payment plan'
          : 'Client payment recorded'
    );
  };

  return (
    <ConstructiongraphWorkbench
      title="Payments"
      description="Progress-payment dates on the project plan. Contractor issues the claim, you certify the IPC, the client records payment — plan vs actual cash."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-6 gap-2">
            <ConstructionProjectSelect
              store={store}
              value={siteId}
              onChange={setSiteId}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="PP-04"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Title (e.g. Month 3 structure)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Planned amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Date payment
            </button>
            <label className="text-xs text-stone-500 sm:col-span-3">
              Planned claim
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                value={claimDate}
                onChange={(e) => {
                  setClaimDate(e.target.value);
                  if (e.target.value && !payDate) {
                    setPayDate(addDaysIso(e.target.value, 21));
                  }
                }}
              />
            </label>
            <label className="text-xs text-stone-500 sm:col-span-3">
              Planned client pay (JBCC +21d default)
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </label>
          </div>

          {store.sites.length === 0 ? (
            <ConstructionEmptyHint>
              Add a project before dating progress payments.
            </ConstructionEmptyHint>
          ) : (
            store.sites.map((site) => {
              const rows = store.payments.filter((p) => p.site_id === site.id);
              const cash = paymentCashflow(store, site.id);
              const report = projectReport(store, site.id);
              return (
                <div
                  key={site.id}
                  className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2"
                >
                  <div className="font-black">
                    {site.code} · {site.name}
                  </div>
                  <div className="text-xs text-stone-500">
                    Budget {zar(report?.budget || 0)} · costs {zar(report?.costs || 0)} ·
                    planned claims {zar(cash.planned)} · paid {zar(cash.paid)} ·
                    outstanding {zar(cash.outstanding)}
                    {cash.overdue ? ` · ${cash.overdue} overdue` : ''}
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-xs text-stone-500">
                      No progress payments on this project plan yet.
                    </p>
                  ) : (
                    rows.map((row) => {
                      const status = resolvePaymentStatus(row);
                      return (
                        <div
                          key={row.id}
                          className="border-t pt-2 flex flex-wrap items-start justify-between gap-2"
                        >
                          <div>
                            <b>
                              {row.number} · {row.title}
                            </b>{' '}
                            · {status}
                            <div className="text-xs text-stone-500">
                              claim {row.planned_claim_date || '—'}
                              {row.claimed_at ? ` · issued ${row.claimed_at}` : ''} ·
                              client pay {row.planned_pay_date || '—'}
                              {row.paid_at ? ` · paid ${row.paid_at}` : ''} · planned{' '}
                              {zar(row.planned_amount)} · certified{' '}
                              {zar(row.certified_amount || 0)} · received{' '}
                              {zar(row.paid_amount || 0)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!row.claimed_at && !row.paid_at ? (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void run(row.id, 'claim')}
                                className="btn-secondary !py-1 !px-2 text-xs"
                              >
                                Issue claim
                              </button>
                            ) : null}
                            {row.claimed_at && !row.certified_at && !row.paid_at ? (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void run(row.id, 'certify')}
                                className="btn-secondary !py-1 !px-2 text-xs"
                              >
                                Certify IPC
                              </button>
                            ) : null}
                            {!row.paid_at && (row.claimed_at || row.certified_at) ? (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void run(row.id, 'pay')}
                                className="btn-primary !py-1 !px-2 text-xs"
                              >
                                Record client pay
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
