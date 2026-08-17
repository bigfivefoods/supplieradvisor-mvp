'use client';

import { useMemo, useState } from 'react';
import {
  EXPERIENCE_LEVELS,
  MEDICAL_SCHEME_OPTIONS,
  PASSPORT_ID_TYPES,
  PASSPORT_LANGUAGES,
  PASSPORT_SEX_OPTIONS,
  PASSPORT_TITLES,
  SA_PROVINCES,
  emptyMemberPassport,
  passportCompleteness,
  type MemberPassport,
} from '@/lib/b2c/member-passport';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[11px] font-bold text-slate-600">
      {label}
      {hint ? (
        <span className="ml-1 font-medium text-slate-400">{hint}</span>
      ) : null}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900';

export function B2cPassportForm({
  value,
  city,
  onCity,
  onChange,
}: {
  value?: MemberPassport | null;
  city: string;
  onCity: (v: string) => void;
  onChange: (next: MemberPassport) => void;
}) {
  const passport = useMemo(
    (): MemberPassport => ({
      ...emptyMemberPassport(),
      ...value,
      city: city || value?.city || '',
    }),
    [value, city]
  );
  const [open, setOpen] = useState<string>('about');
  const done = passportCompleteness(passport);

  const set = (patch: Partial<MemberPassport>) => {
    const next: MemberPassport = { ...passport, ...patch };
    if (patch.city != null) onCity(String(patch.city));
    onChange(next);
  };

  const sections: Array<{ id: string; title: string; blurb: string }> = [
    { id: 'about', title: 'About you', blurb: 'Name details desks reuse' },
    { id: 'address', title: 'Address', blurb: 'For claims and deliveries' },
    { id: 'emergency', title: 'Emergency', blurb: 'Who to call at the gym' },
    { id: 'health', title: 'Health & medical aid', blurb: 'Clinics and coaches' },
    { id: 'goals', title: 'Training goals', blurb: 'Optional, for the gym' },
    { id: 'share', title: 'Sharing', blurb: 'What Advisors may reuse' },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">
            Details Advisors can reuse
          </h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Fill this once. When you join a gym or clinic we send the facts
            they need — you do not fill the same form again.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-black text-[#0077b6]">
          {done.score}/{done.max}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {sections.map((s) => {
          const shown = open === s.id;
          return (
            <div
              key={s.id}
              className="overflow-hidden rounded-2xl border border-slate-200"
            >
              <button
                type="button"
                onClick={() => setOpen(shown ? '' : s.id)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span>
                  <span className="block text-xs font-black text-slate-900">
                    {s.title}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {s.blurb}
                  </span>
                </span>
                <span className="text-[11px] font-bold text-[#0077b6]">
                  {shown ? 'Hide' : 'Edit'}
                </span>
              </button>
              {shown ? (
                <div className="space-y-2 border-t border-slate-100 px-3 py-3">
                  {s.id === 'about' ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Title">
                          <select
                            className={inputClass}
                            value={passport.title || ''}
                            onChange={(e) => set({ title: e.target.value })}
                          >
                            {PASSPORT_TITLES.map((t) => (
                              <option key={t || 'none'} value={t}>
                                {t || '—'}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Preferred name" hint="optional">
                          <input
                            className={inputClass}
                            value={passport.preferred_name || ''}
                            onChange={(e) =>
                              set({ preferred_name: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Date of birth">
                          <input
                            type="date"
                            className={inputClass}
                            value={passport.date_of_birth || ''}
                            onChange={(e) =>
                              set({ date_of_birth: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Sex">
                          <select
                            className={inputClass}
                            value={passport.sex || ''}
                            onChange={(e) => set({ sex: e.target.value })}
                          >
                            {PASSPORT_SEX_OPTIONS.map((o) => (
                              <option key={o.value || 'x'} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Language">
                          <select
                            className={inputClass}
                            value={passport.language || ''}
                            onChange={(e) => set({ language: e.target.value })}
                          >
                            <option value="">—</option>
                            {PASSPORT_LANGUAGES.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="ID type">
                          <select
                            className={inputClass}
                            value={passport.id_type || ''}
                            onChange={(e) => set({ id_type: e.target.value })}
                          >
                            <option value="">—</option>
                            {PASSPORT_ID_TYPES.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Nationality">
                          <input
                            className={inputClass}
                            value={passport.nationality || ''}
                            onChange={(e) =>
                              set({ nationality: e.target.value })
                            }
                            placeholder="South African"
                          />
                        </Field>
                      </div>
                    </>
                  ) : null}

                  {s.id === 'address' ? (
                    <>
                      <Field label="Street">
                        <input
                          type="text"
                          autoComplete="street-address"
                          className={inputClass}
                          value={passport.address_line1 || ''}
                          onChange={(e) =>
                            set({ address_line1: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Suburb">
                        <input
                          className={inputClass}
                          value={passport.suburb || ''}
                          onChange={(e) => set({ suburb: e.target.value })}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="City">
                          <input
                            className={inputClass}
                            value={city || passport.city || ''}
                            onChange={(e) => set({ city: e.target.value })}
                          />
                        </Field>
                        <Field label="Province">
                          <select
                            className={inputClass}
                            value={passport.province || ''}
                            onChange={(e) =>
                              set({ province: e.target.value })
                            }
                          >
                            <option value="">—</option>
                            {SA_PROVINCES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Postal code">
                          <input
                            className={inputClass}
                            inputMode="numeric"
                            value={passport.postal_code || ''}
                            onChange={(e) =>
                              set({ postal_code: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Country">
                          <input
                            className={inputClass}
                            value={passport.country || 'South Africa'}
                            onChange={(e) =>
                              set({ country: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                    </>
                  ) : null}

                  {s.id === 'emergency' ? (
                    <>
                      <Field label="Contact name">
                        <input
                          className={inputClass}
                          value={passport.emergency_name || ''}
                          onChange={(e) =>
                            set({ emergency_name: e.target.value })
                          }
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Phone">
                          <input
                            className={inputClass}
                            inputMode="tel"
                            value={passport.emergency_phone || ''}
                            onChange={(e) =>
                              set({ emergency_phone: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Relationship">
                          <input
                            className={inputClass}
                            value={passport.emergency_relationship || ''}
                            onChange={(e) =>
                              set({ emergency_relationship: e.target.value })
                            }
                            placeholder="Spouse, parent…"
                          />
                        </Field>
                      </div>
                    </>
                  ) : null}

                  {s.id === 'health' ? (
                    <>
                      <Field label="Medical aid">
                        <select
                          className={inputClass}
                          value={passport.medical_aid_scheme || ''}
                          onChange={(e) =>
                            set({ medical_aid_scheme: e.target.value })
                          }
                        >
                          <option value="">None / cash</option>
                          {MEDICAL_SCHEME_OPTIONS.map((sName) => (
                            <option key={sName} value={sName}>
                              {sName}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Plan">
                          <input
                            className={inputClass}
                            value={passport.medical_aid_plan || ''}
                            onChange={(e) =>
                              set({ medical_aid_plan: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Membership no.">
                          <input
                            className={inputClass}
                            value={passport.medical_aid_number || ''}
                            onChange={(e) =>
                              set({ medical_aid_number: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      <Field label="Allergies" hint="or write None">
                        <input
                          className={inputClass}
                          value={passport.allergies || ''}
                          onChange={(e) => set({ allergies: e.target.value })}
                        />
                      </Field>
                      <Field label="Chronic conditions">
                        <input
                          className={inputClass}
                          value={passport.chronic_conditions || ''}
                          onChange={(e) =>
                            set({ chronic_conditions: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Current medication">
                        <input
                          className={inputClass}
                          value={passport.medications || ''}
                          onChange={(e) =>
                            set({ medications: e.target.value })
                          }
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="GP name">
                          <input
                            className={inputClass}
                            value={passport.gp_name || ''}
                            onChange={(e) => set({ gp_name: e.target.value })}
                          />
                        </Field>
                        <Field label="GP phone">
                          <input
                            className={inputClass}
                            inputMode="tel"
                            value={passport.gp_phone || ''}
                            onChange={(e) => set({ gp_phone: e.target.value })}
                          />
                        </Field>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={passport.injured === true}
                          onChange={(e) => set({ injured: e.target.checked })}
                        />
                        I have an injury a coach or clinician should know about
                      </label>
                      {passport.injured ? (
                        <>
                          <Field label="Injury notes">
                            <textarea
                              className={`${inputClass} min-h-[72px]`}
                              value={passport.injury_notes || ''}
                              onChange={(e) =>
                                set({ injury_notes: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="What to avoid / modify">
                            <input
                              className={inputClass}
                              value={passport.training_modifications || ''}
                              onChange={(e) =>
                                set({
                                  training_modifications: e.target.value,
                                })
                              }
                            />
                          </Field>
                        </>
                      ) : null}
                    </>
                  ) : null}

                  {s.id === 'goals' ? (
                    <>
                      <Field label="Experience">
                        <select
                          className={inputClass}
                          value={passport.experience_level || ''}
                          onChange={(e) =>
                            set({ experience_level: e.target.value })
                          }
                        >
                          {EXPERIENCE_LEVELS.map((o) => (
                            <option key={o.value || 'n'} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Goals">
                        <textarea
                          className={`${inputClass} min-h-[72px]`}
                          value={passport.goals || ''}
                          onChange={(e) => set({ goals: e.target.value })}
                          placeholder="Get stronger, recover from back pain…"
                        />
                      </Field>
                    </>
                  ) : null}

                  {s.id === 'share' ? (
                    <>
                      <label className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={passport.share_health_with_advisors !== false}
                          onChange={(e) =>
                            set({
                              share_health_with_advisors: e.target.checked,
                            })
                          }
                        />
                        Send health, emergency and medical-aid details to gyms
                        and clinics I join
                      </label>
                      <label className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={passport.popia_consent === true}
                          onChange={(e) =>
                            set({ popia_consent: e.target.checked })
                          }
                        />
                        I consent to Advisors holding this information under
                        POPIA to treat or train me
                      </label>
                      <label className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={passport.marketing_opt_in === true}
                          onChange={(e) =>
                            set({ marketing_opt_in: e.target.checked })
                          }
                        />
                        Brands I join may email or WhatsApp class and offer
                        updates
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {done.missing.length ? (
        <p className="mt-3 text-[11px] text-slate-500">
          Still useful to add: {done.missing.join(', ')}.
        </p>
      ) : (
        <p className="mt-3 text-[11px] font-semibold text-emerald-800">
          Advisors can reuse this passport when you sign up.
        </p>
      )}
    </section>
  );
}
