'use client';

import { CALENDAR_SWATCHES, normalizeEventHex } from '@/lib/schedule/event-color';

export function GymColorSwatch({
  value,
  onChange,
  label = 'Calendar colour',
}: {
  value?: string;
  onChange: (hex: string) => void;
  label?: string;
}) {
  const current = normalizeEventHex(value) || CALENDAR_SWATCHES[0];
  return (
    <div className="sm:col-span-2">
      <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {CALENDAR_SWATCHES.map((hex) => {
          const on = current.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-pressed={on}
              onClick={() => onChange(hex)}
              className={`h-7 w-7 rounded-full border-2 ${
                on ? 'border-slate-900 ring-2 ring-slate-400 dark:border-white' : 'border-white shadow'
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
        <input
          type="color"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
          title="Custom colour"
        />
      </div>
    </div>
  );
}
