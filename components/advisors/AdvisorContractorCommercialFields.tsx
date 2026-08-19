'use client';

import {
  CONTRACTOR_PAYMENT_METHODS,
  CONTRACTOR_PAYMENT_OPTIONS,
  applyContractorPaymentOption,
  computeContractorTake,
  contractorPaymentMethodLabel,
  contractorPaymentOptionById,
  formatClinicZar,
  formatContractorTake,
  optionUsesShare,
  type ContractorCommercialDraft,
} from '@/lib/clinic/contractor-commercial';

const DEFAULT_RATE_BASES = [
  'hourly',
  'per_session',
  'per_appointment',
  'monthly',
  'fixed',
  'package',
] as const;

export function AdvisorContractorCommercialFields({
  value,
  onChange,
  inputClass,
  labelClass = 'text-[10px] font-black uppercase tracking-wider text-slate-500',
  hintClass = 'text-[11px] text-slate-500',
  accentClass = 'border-amber-200 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30',
  rateBases = DEFAULT_RATE_BASES,
  disabled,
  compact,
}: {
  value: ContractorCommercialDraft;
  onChange: (patch: Partial<ContractorCommercialDraft>) => void;
  inputClass: string;
  labelClass?: string;
  hintClass?: string;
  accentClass?: string;
  rateBases?: readonly string[];
  disabled?: boolean;
  compact?: boolean;
}) {
  const option = contractorPaymentOptionById(value.contractor_payment_option);
  const take = computeContractorTake({
    rate_zar: value.rate_zar === '' ? null : Number(value.rate_zar),
    rate_basis: value.rate_basis,
    charge_out_zar:
      value.charge_out_zar === '' ? null : Number(value.charge_out_zar),
    charge_out_basis: value.charge_out_basis,
    contractor_share_pct:
      value.contractor_share_pct === ''
        ? null
        : Number(value.contractor_share_pct),
    contractor_payment_option: value.contractor_payment_option,
  });
  const showShare = optionUsesShare(value.contractor_payment_option);

  const pickOption = (id: string) => {
    const next = applyContractorPaymentOption(value, id);
    onChange({
      contractor_payment_option: next.contractor_payment_option,
      contractor_payment_method: next.contractor_payment_method,
      rate_basis: next.rate_basis,
      charge_out_basis: next.charge_out_basis,
    });
  };

  return (
    <div
      className={`${compact ? '' : 'sm:col-span-2 lg:col-span-3'} rounded-xl border p-3 space-y-2 ${accentClass}`}
    >
      <div>
        <p className={labelClass}>Commercial contract terms</p>
        <p className={`${hintClass} mt-0.5 font-normal normal-case tracking-normal`}>
          Select how this contractor is paid, their pay-in rate, and the
          charge-out you bill on sessions and packages — so you can see the
          practice take.
        </p>
      </div>

      <label className="block">
        <span className={labelClass}>Payment option</span>
        <select
          className={inputClass + ' mt-1'}
          disabled={disabled}
          value={value.contractor_payment_option}
          onChange={(e) => pickOption(e.target.value)}
        >
          <option value="">Select a commercial payment option</option>
          {CONTRACTOR_PAYMENT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {option ? (
        <p className={hintClass}>{option.description}</p>
      ) : (
        <p className={hintClass}>
          Choose the commercial deal first. Rate bases update to match; you can
          still override them.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className={labelClass}>Payment method</span>
          <select
            className={inputClass + ' mt-1'}
            disabled={disabled}
            value={value.contractor_payment_method}
            onChange={(e) =>
              onChange({ contractor_payment_method: e.target.value })
            }
          >
            {CONTRACTOR_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {contractorPaymentMethodLabel(m)}
              </option>
            ))}
          </select>
        </label>
        {showShare ? (
          <label className="block">
            <span className={labelClass}>Contractor share %</span>
            <input
              className={inputClass + ' mt-1'}
              type="number"
              min={0}
              max={100}
              step="0.1"
              disabled={disabled}
              placeholder="e.g. 40"
              value={value.contractor_share_pct}
              onChange={(e) =>
                onChange({ contractor_share_pct: e.target.value })
              }
            />
          </label>
        ) : null}
        <label className="block">
          <span className={labelClass}>Contractor pay (ZAR)</span>
          <input
            className={inputClass + ' mt-1'}
            type="number"
            min={0}
            step="0.01"
            disabled={disabled}
            placeholder={
              value.contractor_payment_option === 'revenue_share'
                ? 'Optional if using % share'
                : 'e.g. 750'
            }
            value={value.rate_zar}
            onChange={(e) => onChange({ rate_zar: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Pay basis</span>
          <select
            className={inputClass + ' mt-1'}
            disabled={disabled}
            value={value.rate_basis}
            onChange={(e) => onChange({ rate_basis: e.target.value })}
          >
            {rateBases.map((b) => (
              <option key={b} value={b}>
                {b.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Charge-out (ZAR)</span>
          <input
            className={inputClass + ' mt-1'}
            type="number"
            min={0}
            step="0.01"
            disabled={disabled}
            placeholder="What you bill patients / packages"
            value={value.charge_out_zar}
            onChange={(e) => onChange({ charge_out_zar: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Charge-out basis</span>
          <select
            className={inputClass + ' mt-1'}
            disabled={disabled}
            value={value.charge_out_basis}
            onChange={(e) => onChange({ charge_out_basis: e.target.value })}
          >
            {rateBases.map((b) => (
              <option key={b} value={b}>
                {b.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <input
        className={inputClass}
        disabled={disabled}
        placeholder="Rate note (optional, e.g. rooms included, travel extra)"
        value={value.rate_note}
        onChange={(e) => onChange({ rate_note: e.target.value })}
      />

      {take ? (
        <div className="rounded-lg border border-emerald-200 bg-white/80 px-3 py-2 text-[12px] dark:border-emerald-700/50 dark:bg-emerald-950/40">
          <p className="font-bold text-emerald-950 dark:text-emerald-50">
            {formatContractorTake(take)}
          </p>
          <p className={hintClass + ' mt-0.5'}>
            Contractor {formatClinicZar(take.contractorPay)}
            {' · '}
            Charge-out {formatClinicZar(take.chargeOut)}
            {take.comparable
              ? ` · You keep ${formatClinicZar(take.practiceKeep)} on this unit`
              : ' · Align pay and charge-out bases to see a per-unit take'}
          </p>
        </div>
      ) : (
        <p className={hintClass}>
          Enter contractor pay and charge-out (same basis) to see what the
          practice keeps.
        </p>
      )}
    </div>
  );
}
