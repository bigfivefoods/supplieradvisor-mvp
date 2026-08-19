'use client';

/**
 * Collapsible module-specific ailment desk on the patient profile.
 * Saves to patient.clinical and only shares ticked notes to the member.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AdvisorExpandablePanel } from '@/components/advisors/AdvisorExpandablePanel';
import {
  InjuryProfileFields,
  emptyInjuryForm,
  formToHealthPayload,
  healthToForm,
  type InjuryFormState,
} from '@/components/health/InjuryProfileFields';
import type { PersonHealthProfile } from '@/lib/health/body-map';
import {
  CLINICAL_SHARE_KEYS,
  CLINICAL_SHARE_LABELS,
  DEFAULT_CLINICAL_SHARE,
  ailmentDeskHint,
  ailmentDeskTitle,
  groupedCatalog,
  newConditionId,
  normalizeConditions,
  normalizeShareFlags,
  type AilmentModule,
  type ClinicalShareFlags,
  type ClinicalShareKey,
  type PatientCondition,
} from '@/lib/health/ailments';

const ACCENT: Record<
  string,
  { panel: string; title: string; hint: string; btn: string }
> = {
  teal: {
    panel:
      'border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30',
    title: 'text-teal-950 dark:text-teal-50',
    hint: 'text-teal-800/80 dark:text-teal-200/80',
    btn: 'bg-teal-700 hover:bg-teal-800',
  },
  emerald: {
    panel:
      'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30',
    title: 'text-emerald-950 dark:text-emerald-50',
    hint: 'text-emerald-800/80 dark:text-emerald-200/80',
    btn: 'bg-emerald-700 hover:bg-emerald-800',
  },
  sky: {
    panel:
      'border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/30',
    title: 'text-sky-950 dark:text-sky-50',
    hint: 'text-sky-800/80 dark:text-sky-200/80',
    btn: 'bg-sky-700 hover:bg-sky-800',
  },
  rose: {
    panel:
      'border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30',
    title: 'text-rose-950 dark:text-rose-50',
    hint: 'text-rose-800/80 dark:text-rose-200/80',
    btn: 'bg-rose-700 hover:bg-rose-800',
  },
};

function fromClinical(clinical?: PersonHealthProfile | null): {
  injury: InjuryFormState;
  conditions: PatientCondition[];
  share: ClinicalShareFlags;
} {
  const injury = healthToForm(clinical, clinical?.diagnosis_notes);
  const share = {
    ...DEFAULT_CLINICAL_SHARE,
    ...normalizeShareFlags(clinical?.share),
  };
  return {
    injury,
    conditions: normalizeConditions(clinical?.conditions),
    share,
  };
}

export function PatientAilmentDesk({
  module,
  patientId,
  clinical,
  diagnosisNotes,
  post,
  saving,
  accent = 'teal',
  onSaved,
}: {
  module: AilmentModule;
  patientId: string;
  clinical?: PersonHealthProfile | null;
  diagnosisNotes?: string | null;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  saving?: boolean;
  accent?: 'teal' | 'emerald' | 'sky' | 'rose';
  onSaved?: () => void;
}) {
  const skin = ACCENT[accent] || ACCENT.teal;
  const seed = useMemo(
    () =>
      fromClinical({
        ...clinical,
        diagnosis_notes:
          clinical?.diagnosis_notes || diagnosisNotes || clinical?.diagnosis_notes,
      }),
    [clinical, diagnosisNotes]
  );
  const [open, setOpen] = useState(true);
  const [injury, setInjury] = useState(seed.injury);
  const [conditions, setConditions] = useState(seed.conditions);
  const [share, setShare] = useState(seed.share);
  useEffect(() => {
    setInjury(seed.injury);
    setConditions(seed.conditions);
    setShare(seed.share);
  }, [patientId, seed]);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');
  const groups = useMemo(() => groupedCatalog(module), [module]);

  const selected = new Set(conditions.map((c) => c.label.toLowerCase()));

  const toggleCondition = (label: string, category?: string) => {
    setConditions((prev) => {
      const i = prev.findIndex(
        (c) => c.label.toLowerCase() === label.toLowerCase()
      );
      if (i >= 0) return prev.filter((_, idx) => idx !== i);
      return [
        ...prev,
        {
          id: newConditionId(),
          label,
          category,
          status: 'active',
          share: true,
        },
      ];
    });
  };

  const patchCondition = (id: string, patch: Partial<PatientCondition>) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = formToHealthPayload(injury);
      const next: PersonHealthProfile = {
        ...clinical,
        ...payload,
        conditions,
        share,
        injured:
          payload.injured ||
          conditions.some((c) => c.status !== 'resolved') ||
          false,
      };
      await post({
        entity: 'patients',
        action: 'upsert',
        record: {
          id: patientId,
          clinical: next,
          diagnosis_notes: next.diagnosis_notes,
          clinical_updated_by: 'desk',
          share_medical: true,
        },
      });
      toast.success('Saved to the patient and member profile');
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const addCustom = () => {
    const label = custom.trim();
    if (!label) return;
    toggleCondition(label, 'Other');
    setCustom('');
  };

  const inp =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

  return (
    <AdvisorExpandablePanel
      title={ailmentDeskTitle(module)}
      description={ailmentDeskHint(module)}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      accentClass={skin.panel}
      titleClass={skin.title}
      hintClass={skin.hint}
    >
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.category}>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              {g.category}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((item) => {
                const on = selected.has(item.label.toLowerCase());
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => toggleCondition(item.label, item.category)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      on
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                        : 'border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input
            className={inp + ' max-w-xs'}
            placeholder="Add another (not in the list)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <button
            type="button"
            onClick={addCustom}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
          >
            Add
          </button>
        </div>

        {conditions.length > 0 ? (
          <ul className="space-y-2">
            {conditions.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {c.label}
                  </p>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                    <input
                      type="checkbox"
                      checked={c.share !== false}
                      onChange={(e) =>
                        patchCondition(c.id, { share: e.target.checked })
                      }
                    />
                    Share with member
                  </label>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <select
                    className={inp}
                    value={c.status || 'active'}
                    onChange={(e) =>
                      patchCondition(c.id, {
                        status: e.target.value as PatientCondition['status'],
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <input
                    className={inp}
                    type="date"
                    value={c.onset || ''}
                    onChange={(e) =>
                      patchCondition(c.id, { onset: e.target.value })
                    }
                  />
                  <input
                    className={inp}
                    placeholder="Note for this condition"
                    value={c.notes || ''}
                    onChange={(e) =>
                      patchCondition(c.id, { notes: e.target.value })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-slate-500">
            No conditions selected yet — tap chips above or add a custom one.
          </p>
        )}

        {module === 'physio' ? (
          <InjuryProfileFields
            variant="clinic"
            clinical
            value={injury}
            onChange={setInjury}
            inputClass={inp}
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">
              Pain 0–10
              <input
                className={inp + ' mt-0.5'}
                type="number"
                min={0}
                max={10}
                value={injury.pain_score}
                onChange={(e) =>
                  setInjury((v) => ({ ...v, pain_score: e.target.value }))
                }
              />
            </label>
            <label className="text-[10px] font-black uppercase text-slate-400">
              Onset
              <input
                className={inp + ' mt-0.5'}
                type="date"
                value={injury.injury_onset}
                onChange={(e) =>
                  setInjury((v) => ({ ...v, injury_onset: e.target.value }))
                }
              />
            </label>
            <textarea
              className={inp + ' min-h-[56px] sm:col-span-2'}
              placeholder="Diagnosis / clinical notes"
              value={injury.diagnosis_notes || ''}
              onChange={(e) =>
                setInjury((v) => ({ ...v, diagnosis_notes: e.target.value }))
              }
            />
            <textarea
              className={inp + ' min-h-[56px] sm:col-span-2'}
              placeholder="What is going on (symptoms / history)"
              value={injury.injury_notes}
              onChange={(e) =>
                setInjury((v) => ({ ...v, injury_notes: e.target.value }))
              }
            />
            <textarea
              className={inp + ' min-h-[48px] sm:col-span-2'}
              placeholder="Treatment goals"
              value={injury.treatment_goals || ''}
              onChange={(e) =>
                setInjury((v) => ({ ...v, treatment_goals: e.target.value }))
              }
            />
            <textarea
              className={inp + ' min-h-[48px] sm:col-span-2'}
              placeholder="Cautions / contraindications"
              value={injury.contraindications || ''}
              onChange={(e) =>
                setInjury((v) => ({
                  ...v,
                  contraindications: e.target.value,
                }))
              }
            />
            <textarea
              className={inp + ' min-h-[48px] sm:col-span-2'}
              placeholder="Progress notes"
              value={injury.progress_notes || ''}
              onChange={(e) =>
                setInjury((v) => ({ ...v, progress_notes: e.target.value }))
              }
            />
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Share with the member
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Ticked notes appear on the patient portal and SA Member care card.
            Unticked notes stay at the practice.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {CLINICAL_SHARE_KEYS.map((key: ClinicalShareKey) => (
              <label
                key={key}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={share[key] !== false}
                  onChange={(e) =>
                    setShare((s) => ({ ...s, [key]: e.target.checked }))
                  }
                />
                {CLINICAL_SHARE_LABELS[key]}
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy || saving}
          onClick={() => void save()}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white disabled:opacity-50 ${skin.btn}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save to member profile
        </button>
      </div>
    </AdvisorExpandablePanel>
  );
}
