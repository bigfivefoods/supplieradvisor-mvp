'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const STEPS = [
  { n: '01', title: 'Netcash settings', body: 'An owner or admin stores the merchant account and Debit Order service key. After save, GymAdvisor® shows only the last four characters. Test connection uses Netcash test mode.', href: '/dashboard/fitgraph/netcash' },
  { n: '02', title: 'Member mandate', body: 'The member enters the bank, branch, account type, holder, debit day, and amount, then signs. Account validation runs before the mandate can go active.', href: '/dashboard/fitgraph/debit-orders' },
  { n: '03', title: 'Masterfile', body: 'Activating a signed mandate uploads that member to the Netcash masterfile. Pending, active, suspended, and cancelled are the only states.', href: '/dashboard/fitgraph/debit-orders' },
  { n: '04', title: 'VAT invoice', body: 'Each active member gets a numbered invoice: plan, add-ons, pro-rata first month, and discounts. It is emailed and can be shared on WhatsApp before the debit date.', href: '/dashboard/fitgraph/billing-runs' },
  { n: '05', title: 'Preview the run', body: 'Totals are shown before anything is submitted. The action date skips weekends, public holidays, and the cut-off.', href: '/dashboard/fitgraph/billing-runs' },
  { n: '06', title: 'Submit the batch', body: 'One idempotent job sends the batch. Submitting again returns the same batch. Every batch is written to the audit log.', href: '/dashboard/fitgraph/billing-runs' },
  { n: '07', title: 'Reconcile', body: 'Statements mark each member paid or unpaid with the Netcash reason. Retries, a late fee, dunning, and an optional GymAdvisor® access hold follow. Paid invoices settle to the bank and AR.', href: '/dashboard/fitgraph/collections' },
] as const;

export default function GymDebitFlow({
  linkFor = (href: string) => href,
}: {
  linkFor?: (href: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white" aria-label="Debit order process">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="gym-debit-flow-panel"
        className="flex w-full items-start gap-3 bg-[#00b4d8] px-4 py-4 text-left text-[#0f172a] sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em]">GymAdvisor® · SupplierAdvisor®</p>
          <h2 className="mt-0.5 text-lg font-black leading-tight sm:text-xl">Mandate → invoice → Netcash → reconcile</h2>
          <p className="mt-1 text-sm font-semibold">Seven steps. Closed until you open them. Test mode does not move money.</p>
        </span>
        <ChevronDown className={`mt-1 h-5 w-5 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div id="gym-debit-flow-panel" hidden={!open}>
        {open ? (
          <ol className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-2xl border border-slate-200 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">{step.n}</p>
                <h3 className="font-black text-[#0f172a]">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
                <Link href={linkFor(step.href)} className="mt-2 inline-flex min-h-11 items-center text-sm font-black text-[#0077b6] underline">
                  Open this step
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
