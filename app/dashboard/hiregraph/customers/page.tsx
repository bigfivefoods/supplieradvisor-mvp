'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import { StatRow, fieldClass } from '@/components/hire/SimpleEntityForm';
import {
  HIRE_REQUIREMENT_LABELS,
  type HireRequirementKey,
} from '@/lib/hire/hiregraph';

const COMMON_REQ: HireRequirementKey[] = [
  'id_document',
  'proof_of_address',
  'drivers_licence',
  'age_18_plus',
  'age_21_plus',
  'credit_card_hold',
  'adult_supervision',
  'flat_level_ground',
  'power_access_220v',
];

/**
 * Hire renters = Core OS Customers (CRM) book.
 * Hire-only KYC checklist is cached per CRM customer id.
 */
export default function HireCustomersPage() {
  const { store, coreCustomers, loading, saving, post, summary } =
    useHiregraph();
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [reqs, setReqs] = useState<HireRequirementKey[]>([]);

  const bookingCountByCustomer = new Map<number, number>();
  for (const b of store?.bookings || []) {
    const cid = Number(b.crm_customer_id || b.customer_id);
    if (!cid) continue;
    bookingCountByCustomer.set(cid, (bookingCountByCustomer.get(cid) || 0) + 1);
  }

  const pickCustomer = (id: number) => {
    setSelectedId(id);
    const kyc = store?.customer_kyc?.[String(id)] || [];
    setReqs([...kyc]);
  };

  const toggleReq = (r: HireRequirementKey) => {
    setReqs((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const saveKyc = async () => {
    if (!selectedId) {
      toast.error('Select a customer first');
      return;
    }
    await post({
      action: 'set_kyc',
      crm_customer_id: selectedId,
      requirements_met: reqs,
    });
    toast.success('Hire requirements saved for this customer');
  };

  return (
    <HiregraphWorkbench
      title="Hire customers"
      titleAccent="Core Customers module"
      description="People and companies who rent gear live in Core OS Customers (CRM). Manage the book there; set hire-specific requirements (licence, deposit, castle safety…) here."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 dark:border-cyan-500/30 dark:bg-cyan-950/40">
            <p className="text-sm text-cyan-950 dark:text-cyan-50">
              <strong>Source of truth:</strong> Customers module — B2C renters
              and hire clients.
            </p>
            <Link
              href="/dashboard/customers"
              className="inline-flex items-center gap-1 rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white"
            >
              Open Customers <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <StatRow
            tone="hg-talent"
            items={[
              { label: 'Core customers', value: coreCustomers.length },
              {
                label: 'With bookings',
                value: bookingCountByCustomer.size,
              },
              {
                label: 'Open bookings',
                value: Number(summary?.openBookings) || 0,
              },
            ]}
          />

          {coreCustomers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center dark:border-cyan-500/20 dark:bg-cyan-950/30">
              <UserRound className="mx-auto h-8 w-8 text-slate-300 dark:text-cyan-300" />
              <p className="mt-3 font-bold text-slate-800 dark:text-white">
                No customers on this company yet
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-cyan-100/70">
                Add renters under Core Customers, then book hires against them.
              </p>
              <Link
                href="/dashboard/customers"
                className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-bold text-white"
              >
                Go to Customers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-2">
                <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 dark:divide-cyan-500/15 dark:border-cyan-500/25">
                  {coreCustomers.map((c) => {
                    const n = bookingCountByCustomer.get(c.id) || 0;
                    const active = selectedId === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => pickCustomer(c.id)}
                          className={`flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition ${
                            active
                              ? 'bg-cyan-50 dark:bg-cyan-900/40'
                              : 'bg-white hover:bg-slate-50 dark:bg-transparent dark:hover:bg-cyan-950/30'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {c.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-cyan-100/65">
                              {[c.email, c.phone, c.city]
                                .filter(Boolean)
                                .join(' · ') || `CRM #${c.id}`}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-cyan-100/70">
                            {n} bookings
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-cyan-500/25 dark:bg-cyan-950/20">
                  <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                    Hire requirements (KYC cache)
                  </p>
                  <label className="mt-2 block text-xs font-bold">
                    Customer
                    <select
                      className={fieldClass()}
                      value={selectedId}
                      onChange={(e) =>
                        pickCustomer(Number(e.target.value) || 0)
                      }
                    >
                      <option value="">— select —</option>
                      {coreCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {COMMON_REQ.map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={!selectedId}
                        onClick={() => toggleReq(r)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold disabled:opacity-40 ${
                          reqs.includes(r)
                            ? 'border-cyan-500 bg-cyan-600 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-cyan-500/20 dark:bg-cyan-950/40 dark:text-cyan-50'
                        }`}
                      >
                        {HIRE_REQUIREMENT_LABELS[r]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!selectedId || saving}
                    onClick={() => void saveKyc()}
                    className="mt-4 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save hire requirements'}
                  </button>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-cyan-100/60">
                    Used when booking (e.g. jumping castles need power, flat
                    ground, adult supervision).
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </HiregraphWorkbench>
  );
}
