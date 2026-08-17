'use client';

import {
  DEBIT_ACCOUNT_TYPES,
  SA_DEBIT_BANKS,
} from '@/lib/fitness/member-debit-bank';

export type DebitBankForm = {
  account_holder: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_type: string;
  debit_order_authorised: boolean;
};

export const emptyDebitBankForm = (): DebitBankForm => ({
  account_holder: '',
  bank_name: '',
  account_number: '',
  branch_code: '',
  account_type: 'cheque',
  debit_order_authorised: false,
});

export function MemberDebitBankFields({
  value,
  onChange,
  required,
  complete,
  inputClass,
}: {
  value: DebitBankForm;
  onChange: (next: DebitBankForm) => void;
  required?: boolean;
  complete?: boolean;
  inputClass?: string;
}) {
  const box = inputClass || 'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';
  const pickBank = (name: string) => {
    const known = SA_DEBIT_BANKS.find((b) => b.name === name);
    onChange({
      ...value,
      bank_name: name,
      branch_code:
        known && known.branch_code ? known.branch_code : value.branch_code,
    });
  };
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div>
        <p className="text-sm font-black text-slate-900">
          Bank account for debit order
          {required ? <span className="text-rose-600"> *</span> : null}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          The gym owner sets up the debit order against this account. This is
          not a card or Apple Pay charge.
        </p>
        {complete ? (
          <p className="mt-1 text-[11px] font-bold text-emerald-800">
            Bank details on file — membership can complete.
          </p>
        ) : required ? (
          <p className="mt-1 text-[11px] font-bold text-amber-800">
            Required to complete your membership.
          </p>
        ) : null}
      </div>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-slate-500">
          Account holder
        </span>
        <input
          className={box}
          value={value.account_holder}
          onChange={(e) =>
            onChange({ ...value, account_holder: e.target.value })
          }
          placeholder="Name on the account"
          autoComplete="name"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-slate-500">
          Bank
        </span>
        <select
          className={box}
          value={value.bank_name}
          onChange={(e) => pickBank(e.target.value)}
        >
          <option value="">Select bank…</option>
          {SA_DEBIT_BANKS.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-slate-500">
          Account number
        </span>
        <input
          className={box}
          inputMode="numeric"
          autoComplete="off"
          value={value.account_number}
          onChange={(e) =>
            onChange({ ...value, account_number: e.target.value })
          }
          placeholder="Digits only"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-slate-500">
          Branch code
        </span>
        <input
          className={box}
          inputMode="numeric"
          autoComplete="off"
          value={value.branch_code}
          onChange={(e) =>
            onChange({ ...value, branch_code: e.target.value })
          }
          placeholder="6-digit universal code"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-slate-500">
          Account type
        </span>
        <select
          className={box}
          value={value.account_type}
          onChange={(e) =>
            onChange({ ...value, account_type: e.target.value })
          }
        >
          {DEBIT_ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'cheque' ? 'Cheque / current' : t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={value.debit_order_authorised}
          onChange={(e) =>
            onChange({
              ...value,
              debit_order_authorised: e.target.checked,
            })
          }
        />
        <span>
          I authorise the gym to debit this account for my membership fees.
          <span className="block text-[11px] text-slate-500">
            You can update these details later if your bank account changes.
          </span>
        </span>
      </label>
    </div>
  );
}
