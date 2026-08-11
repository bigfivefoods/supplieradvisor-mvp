'use client';

/**
 * Compact inline editors for Advisor list tables (members / patients).
 * Saves on blur or change — only for simple visible fields.
 */

import { useEffect, useState } from 'react';

const inputBase =
  'w-full min-w-[5.5rem] max-w-[12rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100';

type TextProps = {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Wider name fields */
  wide?: boolean;
};

export function InlineText({
  value,
  onSave,
  placeholder,
  className = '',
  disabled,
  wide,
}: TextProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = async () => {
    const next = draft.trim();
    if (next === (value || '').trim()) return;
    await onSave(next);
  };

  return (
    <input
      className={`${inputBase} ${wide ? 'min-w-[8rem] max-w-[14rem]' : ''} ${className}`}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

type SelectOption = { value: string; label: string };

type SelectProps = {
  value: string;
  options: SelectOption[];
  onSave: (next: string) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
  allowEmpty?: boolean;
};

export function InlineSelect({
  value,
  options,
  onSave,
  className = '',
  disabled,
  emptyLabel = '—',
  allowEmpty = true,
}: SelectProps) {
  return (
    <select
      className={`${inputBase} max-w-[11rem] ${className}`}
      value={value || ''}
      disabled={disabled}
      onChange={(e) => void onSave(e.target.value)}
      title="Click to change"
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type ToggleProps = {
  value: boolean;
  onSave: (next: boolean) => void | Promise<void>;
  trueLabel?: string;
  falseLabel?: string;
  disabled?: boolean;
};

/** Two-state chip select (e.g. Private client / Gym member) */
export function InlineToggleSelect({
  value,
  onSave,
  trueLabel = 'Yes',
  falseLabel = 'No',
  disabled,
}: ToggleProps) {
  return (
    <select
      className={inputBase}
      value={value ? '1' : '0'}
      disabled={disabled}
      onChange={(e) => void onSave(e.target.value === '1')}
      title="Click to change"
    >
      <option value="0">{falseLabel}</option>
      <option value="1">{trueLabel}</option>
    </select>
  );
}
