'use client';

/**
 * Shared injury / ailment editor for FitAdvisor clients and PhysioAdvisor patients.
 * Coaches & practitioners keep body region, side, status and modifications current
 * so sessions can be adapted to help recovery.
 */
import {
  BODY_REGIONS,
  INJURY_SIDES,
  INJURY_STATUSES,
  type PersonHealthProfile,
} from '@/lib/health/body-map';

export type InjuryFormState = {
  injured: boolean;
  injury_areas: string[];
  injury_side: string;
  injury_status: string;
  injury_onset: string;
  injury_notes: string;
  training_modifications: string;
  goals: string;
  medical_clearance: '' | 'yes' | 'no';
  pain_score: string;
  /** Clinical extras (physio) */
  diagnosis_notes?: string;
  treatment_goals?: string;
  contraindications?: string;
  functional_limitations?: string;
  progress_notes?: string;
};

export function healthToForm(
  h?: PersonHealthProfile | null,
  legacyDiagnosis?: string
): InjuryFormState {
  return {
    injured: h?.injured === true,
    injury_areas: Array.isArray(h?.injury_areas) ? [...h!.injury_areas!] : [],
    injury_side: h?.injury_side || 'n/a',
    injury_status: h?.injury_status || 'none',
    injury_onset: h?.injury_onset ? String(h.injury_onset).slice(0, 10) : '',
    injury_notes: h?.injury_notes || '',
    training_modifications: h?.training_modifications || '',
    goals: h?.goals || '',
    medical_clearance:
      h?.medical_clearance === true
        ? 'yes'
        : h?.medical_clearance === false
          ? 'no'
          : '',
    pain_score:
      h?.pain_score != null && Number.isFinite(Number(h.pain_score))
        ? String(h.pain_score)
        : '',
    diagnosis_notes: h?.diagnosis_notes || legacyDiagnosis || '',
    treatment_goals: h?.treatment_goals || '',
    contraindications: h?.contraindications || '',
    functional_limitations: h?.functional_limitations || '',
    progress_notes: h?.progress_notes || '',
  };
}

export function formToHealthPayload(form: InjuryFormState): PersonHealthProfile {
  return {
    injured: form.injured,
    injury_areas: form.injury_areas,
    injury_side: form.injury_side || 'n/a',
    injury_status: form.injury_status || 'none',
    injury_onset: form.injury_onset || null,
    injury_notes: form.injury_notes,
    training_modifications: form.training_modifications,
    goals: form.goals,
    medical_clearance:
      form.medical_clearance === 'yes'
        ? true
        : form.medical_clearance === 'no'
          ? false
          : null,
    pain_score:
      form.pain_score === '' ? null : Number(form.pain_score),
    diagnosis_notes: form.diagnosis_notes,
    treatment_goals: form.treatment_goals,
    contraindications: form.contraindications,
    functional_limitations: form.functional_limitations,
    progress_notes: form.progress_notes,
  };
}

export function emptyInjuryForm(): InjuryFormState {
  return healthToForm(null);
}

type Props = {
  value: InjuryFormState;
  onChange: (next: InjuryFormState) => void;
  /** gym coach vs clinic practitioner copy */
  variant?: 'coach' | 'clinic';
  /** Include diagnosis / contraindications / progress (clinic) */
  clinical?: boolean;
  /** Dark portal styling */
  dark?: boolean;
  inputClass?: string;
};

export function InjuryProfileFields({
  value,
  onChange,
  variant = 'coach',
  clinical = false,
  dark = false,
  inputClass,
}: Props) {
  const fc =
    inputClass ||
    (dark
      ? 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100'
      : 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900');

  const label = dark
    ? 'text-[10px] font-black uppercase tracking-wider text-amber-400 mb-1'
    : 'text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-200 mb-1';

  const chipOn = dark
    ? 'border-rose-500 bg-rose-500 text-white'
    : 'border-rose-600 bg-rose-600 text-white';
  const chipOff = dark
    ? 'border-slate-600 text-slate-300'
    : 'border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

  const toggleArea = (area: string) => {
    const has = value.injury_areas.includes(area);
    const injury_areas = has
      ? value.injury_areas.filter((a) => a !== area)
      : [...value.injury_areas, area];
    onChange({
      ...value,
      injury_areas,
      injured:
        injury_areas.length > 0
          ? true
          : value.injury_status !== 'none' && value.injury_status !== 'cleared'
            ? true
            : value.injured,
    });
  };

  const help =
    variant === 'clinic'
      ? 'Mark body region, side and status so every practitioner and front desk knows how to progress care safely.'
      : 'Mark where they are injured and how to adapt sessions — coaches stay aligned so members improve safely.';

  return (
    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
      <div>
        <p className={label}>Injury & recovery awareness</p>
        <p
          className={
            dark
              ? 'text-[11px] text-slate-400 mb-2'
              : 'text-[11px] text-slate-500 dark:text-slate-400 mb-2'
          }
        >
          {help}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.injured}
          onChange={(e) =>
            onChange({
              ...value,
              injured: e.target.checked,
              injury_status:
                e.target.checked && value.injury_status === 'none'
                  ? 'recovering'
                  : !e.target.checked
                    ? 'cleared'
                    : value.injury_status,
            })
          }
        />
        Currently injured / managing an ailment
      </label>

      <div>
        <p className={label}>Body region(s)</p>
        <div className="flex flex-wrap gap-1.5">
          {BODY_REGIONS.map((r) => {
            const on = value.injury_areas.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleArea(r)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  on ? chipOn : chipOff
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div>
          <p className={label}>Side</p>
          <select
            className={fc}
            value={value.injury_side}
            onChange={(e) =>
              onChange({ ...value, injury_side: e.target.value })
            }
          >
            {INJURY_SIDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className={label}>Status</p>
          <select
            className={fc}
            value={value.injury_status}
            onChange={(e) => {
              const injury_status = e.target.value;
              onChange({
                ...value,
                injury_status,
                injured:
                  injury_status === 'acute' ||
                  injury_status === 'recovering' ||
                  injury_status === 'chronic'
                    ? true
                    : injury_status === 'cleared' || injury_status === 'none'
                      ? false
                      : value.injured,
              });
            }}
          >
            {INJURY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className={label}>Onset date</p>
          <input
            type="date"
            className={fc}
            value={value.injury_onset}
            onChange={(e) =>
              onChange({ ...value, injury_onset: e.target.value })
            }
          />
        </div>
        <div>
          <p className={label}>Pain 0–10</p>
          <input
            type="number"
            min={0}
            max={10}
            className={fc}
            placeholder="—"
            value={value.pain_score}
            onChange={(e) =>
              onChange({ ...value, pain_score: e.target.value })
            }
          />
        </div>
      </div>

      <div>
        <p className={label}>What is going on (symptoms / history)</p>
        <textarea
          className={fc + ' min-h-[3.5rem] resize-y'}
          placeholder="e.g. Right knee ACL recovery week 8 — avoid deep flexion under load…"
          value={value.injury_notes}
          onChange={(e) =>
            onChange({ ...value, injury_notes: e.target.value })
          }
        />
      </div>

      <div>
        <p className={label}>
          {variant === 'clinic'
            ? 'Session modifications / load rules'
            : 'Training modifications (coach cue)'}
        </p>
        <textarea
          className={fc + ' min-h-[3rem] resize-y'}
          placeholder="e.g. No overhead press; closed-chain only; stop if sharp pain…"
          value={value.training_modifications}
          onChange={(e) =>
            onChange({ ...value, training_modifications: e.target.value })
          }
        />
      </div>

      <div>
        <p className={label}>Goals (get better / return to play)</p>
        <textarea
          className={fc + ' min-h-[2.5rem] resize-y'}
          placeholder="e.g. Pain-free stairs · return to 5k · full ROM by date…"
          value={value.goals}
          onChange={(e) => onChange({ ...value, goals: e.target.value })}
        />
      </div>

      <div>
        <p className={label}>Medical clearance</p>
        <select
          className={fc}
          value={value.medical_clearance}
          onChange={(e) =>
            onChange({
              ...value,
              medical_clearance: e.target.value as '' | 'yes' | 'no',
            })
          }
        >
          <option value="">Not recorded</option>
          <option value="yes">Cleared / on file</option>
          <option value="no">Not cleared</option>
        </select>
      </div>

      {clinical ? (
        <>
          <div>
            <p className={label}>Diagnosis / clinical notes</p>
            <textarea
              className={fc + ' min-h-[3rem] resize-y'}
              placeholder="Diagnosis, imaging findings, stage of rehab…"
              value={value.diagnosis_notes || ''}
              onChange={(e) =>
                onChange({ ...value, diagnosis_notes: e.target.value })
              }
            />
          </div>
          <div>
            <p className={label}>Treatment goals</p>
            <textarea
              className={fc + ' min-h-[2.5rem] resize-y'}
              placeholder="Clinical milestones for this episode of care…"
              value={value.treatment_goals || ''}
              onChange={(e) =>
                onChange({ ...value, treatment_goals: e.target.value })
              }
            />
          </div>
          <div>
            <p className={label}>Contraindications</p>
            <textarea
              className={fc + ' min-h-[2.5rem] resize-y'}
              placeholder="What must not be done…"
              value={value.contraindications || ''}
              onChange={(e) =>
                onChange({ ...value, contraindications: e.target.value })
              }
            />
          </div>
          <div>
            <p className={label}>Functional limitations</p>
            <textarea
              className={fc + ' min-h-[2.5rem] resize-y'}
              placeholder="ADL limits, sport limits…"
              value={value.functional_limitations || ''}
              onChange={(e) =>
                onChange({ ...value, functional_limitations: e.target.value })
              }
            />
          </div>
          <div>
            <p className={label}>Progress notes</p>
            <textarea
              className={fc + ' min-h-[3rem] resize-y'}
              placeholder="Latest session response, next focus…"
              value={value.progress_notes || ''}
              onChange={(e) =>
                onChange({ ...value, progress_notes: e.target.value })
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
