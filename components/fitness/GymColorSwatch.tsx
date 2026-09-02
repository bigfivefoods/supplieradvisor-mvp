'use client';

import {
  CALENDAR_SWATCHES,
  hexToRgb,
  normalizeEventHex,
  rgbToHex,
} from '@/lib/schedule/event-color';

export function GymColorSwatch({
  value,
  onChange,
  label = 'Calendar colour',
  compact,
}: {
  value?: string;
  onChange: (hex: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const current = normalizeEventHex(value) || CALENDAR_SWATCHES[0];
  const rgb = hexToRgb(current);
  const setRgb = (patch: Partial<{ r: number; g: number; b: number }>) => {
    onChange(rgbToHex(patch.r ?? rgb.r, patch.g ?? rgb.g, patch.b ?? rgb.b));
  };
  return (
    <div className={compact ? '' : 'sm:col-span-2 lg:col-span-3'}>
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <span
          className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 shadow-inner"
          style={{ backgroundColor: current }}
          title={current}
        />
        <div className="min-w-0 flex-1 space-y-2">
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
                    on
                      ? 'border-slate-900 ring-2 ring-slate-400 dark:border-white'
                      : 'border-white shadow'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] font-bold text-slate-500">
              R
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.r}
                onChange={(e) => setRgb({ r: Number(e.target.value) })}
                className="mt-0.5 w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold"
              />
            </label>
            <label className="text-[10px] font-bold text-slate-500">
              G
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.g}
                onChange={(e) => setRgb({ g: Number(e.target.value) })}
                className="mt-0.5 w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold"
              />
            </label>
            <label className="text-[10px] font-bold text-slate-500">
              B
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.b}
                onChange={(e) => setRgb({ b: Number(e.target.value) })}
                className="mt-0.5 w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold"
              />
            </label>
            <label className="text-[10px] font-bold text-slate-500">
              Hex
              <input
                value={current}
                onChange={(e) => {
                  const n = normalizeEventHex(e.target.value);
                  if (n) onChange(n);
                }}
                className="mt-0.5 w-24 rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm"
                spellCheck={false}
              />
            </label>
            <label className="text-[10px] font-bold text-slate-500">
              Spectrum
              <input
                type="color"
                value={current === '#ffffff' ? '#ffffff' : current}
                onChange={(e) => onChange(e.target.value)}
                className="mt-0.5 h-8 w-12 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                title="RGB colour selector"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GymDiaryColorEditor({
  classes,
  coaches,
  saving,
  onSaveClass,
  onSaveCoach,
}: {
  classes: Array<{ id: string; name: string; color?: string | null }>;
  coaches: Array<{ id: string; name: string; color?: string | null }>;
  saving?: boolean;
  onSaveClass: (id: string, color: string) => void | Promise<void>;
  onSaveCoach: (id: string, color: string) => void | Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-slate-600 dark:text-yellow-100/80">
        Pick a palette colour or set RGB / hex. Class colour fills the diary
        block; coach colour is the left stripe.
      </p>
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-yellow-800">
          Classes
        </p>
        <ul className="space-y-3">
          {classes.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-yellow-100 bg-white px-3 py-2 dark:border-yellow-800 dark:bg-yellow-950/40"
            >
              <p className="mb-1 text-sm font-black text-slate-900 dark:text-yellow-50">
                {c.name}
              </p>
              <GymColorSwatch
                compact
                value={c.color || '#E8E830'}
                onChange={(hex) => {
                  if (!saving) void onSaveClass(c.id, hex);
                }}
                label="Class colour"
              />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-yellow-800">
          Coaches
        </p>
        <ul className="space-y-3">
          {coaches.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-yellow-100 bg-white px-3 py-2 dark:border-yellow-800 dark:bg-yellow-950/40"
            >
              <p className="mb-1 text-sm font-black text-slate-900 dark:text-yellow-50">
                {c.name}
              </p>
              <GymColorSwatch
                compact
                value={c.color || '#d97706'}
                onChange={(hex) => {
                  if (!saving) void onSaveCoach(c.id, hex);
                }}
                label="Coach colour"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
