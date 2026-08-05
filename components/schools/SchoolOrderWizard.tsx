'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildPoReadiness } from '@/lib/schools/order-process';
import { formatMoney } from '@/lib/accounting/types';

export type WizardLine = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  qty: number;
  unit_price: number;
  uom: string;
  category?: string | null;
};

type SpLink = {
  isp_profile_id: number | string;
  display_name?: string;
  preferred?: boolean;
  status?: string;
};

type Props = {
  companyId: number;
  lines: WizardLine[];
  onLinesChange: (lines: WizardLine[]) => void;
  links: SpLink[];
  ispId: string;
  onIspIdChange: (id: string) => void;
  expectedDate: string;
  onExpectedDateChange: (d: string) => void;
  notes: string;
  onNotesChange: (n: string) => void;
  minDeliveryDate: string;
  catalogueLabel: string;
  hasAgency: boolean;
  brandPickOk: boolean | null;
  submitting?: boolean;
  onSubmit: () => void | Promise<void>;
  onCancel?: () => void;
};

const STEPS = [
  { id: 'lines', label: 'Lines & qty' },
  { id: 'sp', label: 'Service provider' },
  { id: 'date', label: 'Delivery date' },
  { id: 'review', label: 'Review & send' },
] as const;

export default function SchoolOrderWizard({
  companyId,
  lines,
  onLinesChange,
  links,
  ispId,
  onIspIdChange,
  expectedDate,
  onExpectedDateChange,
  notes,
  onNotesChange,
  minDeliveryDate,
  catalogueLabel,
  hasAgency,
  brandPickOk,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const [step, setStep] = useState(0);
  void companyId;

  const readiness = useMemo(
    () =>
      buildPoReadiness({
        hasAgency,
        activeSpLinks: links.length,
        lines,
        ispProfileId: ispId ? Number(ispId) : null,
        expectedDate,
        minDate: minDeliveryDate,
        brandPickOk,
      }),
    [
      hasAgency,
      links.length,
      lines,
      ispId,
      expectedDate,
      minDeliveryDate,
      brandPickOk,
    ]
  );

  const nudgeQty = (idx: number, delta: number) => {
    onLinesChange(
      lines.map((l, i) =>
        i === idx
          ? { ...l, qty: Math.max(1, Math.round(Number(l.qty) || 1) + delta) }
          : l
      )
    );
  };

  const removeLine = (idx: number) => {
    onLinesChange(lines.filter((_, i) => i !== idx));
  };

  const canNext =
    step === 0
      ? lines.some((l) => l.qty > 0 && l.approved_product_id > 0)
      : step === 1
        ? Boolean(ispId)
        : step === 2
          ? Boolean(
              expectedDate &&
                /^\d{4}-\d{2}-\d{2}$/.test(expectedDate) &&
                expectedDate >= minDeliveryDate
            )
          : readiness.ok;

  const goNext = () => {
    if (step < STEPS.length - 1) {
      if (!canNext) {
        toast.error(
          step === 0
            ? 'Add at least one line with quantity'
            : step === 1
              ? 'Select a service provider'
              : 'Set a valid required delivery date'
        );
        return;
      }
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50/40 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
            Foolproof order wizard
          </p>
          <h3 className="text-lg font-black text-slate-900">
            School PO → SP → delivery
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Only {catalogueLabel}. SP must buy your brands (approved same-category
            OOS sub = half score).
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            Close
          </button>
        ) : null}
      </div>

      {/* Steps */}
      <div className="flex gap-1.5 overflow-x-auto">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border ${
              i === step
                ? 'bg-[#0077b6] text-white border-[#0077b6]'
                : i < step
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">
            Confirm products & quantities (from kitchen cover or catalogue)
          </p>
          {lines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No lines yet.{' '}
              <Link
                href="/dashboard/schools/kitchen"
                className="font-bold text-[#0077b6] underline"
              >
                Build from kitchen stock
              </Link>{' '}
              or add products below on the classic form.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {lines.map((l, i) => (
                <li
                  key={`${l.approved_product_id}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      <span className="text-emerald-800">{l.brand_name}</span>
                      {' · '}
                      {l.product_name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {l.category || 'catalogue'} · {l.uom}
                      {l.unit_price > 0
                        ? ` · ${formatMoney(l.unit_price)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg border border-slate-200 inline-flex items-center justify-center"
                      onClick={() => nudgeQty(i, -1)}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      className="w-16 rounded-lg border border-sky-200 bg-sky-50/50 px-2 py-1.5 text-sm font-black text-center tabular-nums"
                      value={l.qty}
                      onChange={(e) =>
                        onLinesChange(
                          lines.map((row, j) =>
                            j === i
                              ? {
                                  ...row,
                                  qty: Math.max(0, Number(e.target.value) || 0),
                                }
                              : row
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg border border-slate-200 inline-flex items-center justify-center"
                      onClick={() => nudgeQty(i, 1)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-rose-600 ml-1"
                      onClick={() => removeLine(i)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">
            Who will procure and deliver?
          </p>
          {links.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              No active SP links.{' '}
              <Link
                href="/dashboard/schools/isps"
                className="font-bold underline"
              >
                Link a service provider
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {links.map((l) => {
                const id = String(l.isp_profile_id);
                const on = ispId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onIspIdChange(id)}
                    className={`text-left rounded-2xl border px-3 py-3 transition-all ${
                      on
                        ? 'border-[#00b4d8] bg-sky-50 ring-2 ring-sky-200'
                        : 'border-slate-200 bg-white hover:border-sky-300'
                    }`}
                  >
                    <p className="font-bold text-sm text-slate-900">
                      {l.display_name || `SP #${id}`}
                    </p>
                    {l.preferred ? (
                      <span className="text-[10px] font-bold text-emerald-700">
                        Preferred / high compliance
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        Active link
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-700">
            Required delivery date (OTIF on-time score)
          </p>
          <input
            type="date"
            min={minDeliveryDate}
            className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold"
            value={expectedDate}
            onChange={(e) => onExpectedDateChange(e.target.value)}
          />
          <label className="block text-xs max-w-xl">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Notes for SP (optional)
            </span>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[72px]"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Gate access, delivery window, contact on site…"
            />
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-700">Readiness checklist</p>
          <ul className="space-y-1.5">
            {readiness.checks.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 text-sm rounded-xl bg-white border border-slate-100 px-3 py-2"
              >
                {c.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Circle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      c.required ? 'text-amber-500' : 'text-slate-300'
                    }`}
                  />
                )}
                <div className="min-w-0">
                  <p
                    className={`font-semibold ${
                      c.ok ? 'text-slate-600' : 'text-slate-900'
                    }`}
                  >
                    {c.label}
                    {c.required ? '' : ' (optional)'}
                  </p>
                  <p className="text-[11px] text-slate-500">{c.detail}</p>
                  {!c.ok && c.href ? (
                    <Link
                      href={c.href}
                      className="text-[11px] font-bold text-[#0077b6] underline"
                    >
                      Fix →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <p className="font-black text-slate-900">
              {lines.length} line(s) · SP{' '}
              {links.find((l) => String(l.isp_profile_id) === ispId)
                ?.display_name || ispId}{' '}
              · by {expectedDate || '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              After send: SP accepts → buys school brands → DN + POD → you GRN
              into kitchen.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1 disabled:opacity-40"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting || !readiness.ok}
            onClick={() => void onSubmit()}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            Send PO to SP
          </button>
        )}
      </div>
    </div>
  );
}
