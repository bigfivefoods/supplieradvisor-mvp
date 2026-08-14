'use client';

/**
 * Always-on email / ID / phone for existing coaches and clinicians.
 * Older records were created before these fields were required.
 */
export function needsAdvisorIdentity(person: {
  email?: string | null;
  id_number?: string | null;
}): boolean {
  const email = String(person.email || '').trim();
  const id = String(person.id_number || '').trim();
  return !email.includes('@') || !id;
}

export function AdvisorIdentityPanel({
  email,
  idNumber,
  phone,
  onChange,
  onSave,
  saving,
  inputClass,
  toneClass = 'border-amber-200 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30',
  personLabel = 'this person',
}: {
  email: string;
  idNumber: string;
  phone: string;
  onChange: (patch: {
    email?: string;
    idNumber?: string;
    phone?: string;
  }) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  inputClass: string;
  toneClass?: string;
  personLabel?: string;
}) {
  const missingEmail = !String(email || '').includes('@');
  const missingId = !String(idNumber || '').trim();
  const incomplete = missingEmail || missingId;

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${toneClass}`}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Login email, ID & phone
        </p>
        {incomplete ? (
          <p className="mt-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
            {personLabel} was added before these were required. Add a login
            email and ID / passport (VerifyNow or Didit), then save.
          </p>
        ) : (
          <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
            Used to sign in to the app and to verify identity.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
            Login email *
          </span>
          <input
            className={inputClass + ' mt-0.5'}
            type="email"
            placeholder="name@practice.com"
            value={email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
            ID / passport *
          </span>
          <input
            className={inputClass + ' mt-0.5'}
            placeholder="SA ID or passport number"
            value={idNumber}
            onChange={(e) => onChange({ idNumber: e.target.value })}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
            Phone
          </span>
          <input
            className={inputClass + ' mt-0.5'}
            placeholder="Mobile"
            value={phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void onSave()}
        className="rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        Save email & ID
      </button>
    </div>
  );
}
