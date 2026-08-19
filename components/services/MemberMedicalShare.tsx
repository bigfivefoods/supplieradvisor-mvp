'use client';

/**
 * Patient-facing medical summary — profile + records tabs.
 * Allergies, scripts, advice, care plans. Full charts stay at the practice.
 */
import { Activity, ClipboardList, HeartPulse, Pill, Stethoscope } from 'lucide-react';
import type {
  SharedAdviceNote,
  SharedTreatmentPlan,
} from '@/lib/clinic/medical-share';

const TONE: Record<
  string,
  { border: string; text: string; chip: string; title: string }
> = {
  emerald: {
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    chip: 'bg-emerald-50 text-emerald-900',
    title: 'Your medical information',
  },
  sky: {
    border: 'border-sky-200',
    text: 'text-sky-800',
    chip: 'bg-sky-50 text-sky-900',
    title: 'Your dental information',
  },
  teal: {
    border: 'border-teal-200',
    text: 'text-teal-800',
    chip: 'bg-teal-50 text-teal-900',
    title: 'Your physio information',
  },
  rose: {
    border: 'border-rose-200',
    text: 'text-rose-800',
    chip: 'bg-rose-50 text-rose-900',
    title: 'Your care information',
  },
};

function asText(v: unknown): string {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x != null && x !== '')
      .map(([k, x]) => `${k.replace(/_/g, ' ')}: ${x}`)
      .join(' · ');
  }
  return String(v);
}

function Field({
  label,
  value,
  alert,
}: {
  label: string;
  value: unknown;
  alert?: boolean;
}) {
  const text = asText(value);
  if (!text) return null;
  return (
    <div>
      <dt
        className={`text-[10px] font-bold uppercase tracking-wide ${
          alert ? 'text-rose-600' : 'text-slate-500'
        }`}
      >
        {label}
      </dt>
      <dd
        className={`mt-0.5 whitespace-pre-wrap text-sm ${
          alert ? 'font-semibold text-rose-900' : 'text-slate-800'
        }`}
      >
        {text}
      </dd>
    </div>
  );
}

export function MemberMedicalShare({
  share,
  plans,
  advice,
  followUps,
  tone = 'emerald',
  heading,
}: {
  share?: Record<string, unknown> | null;
  plans?: SharedTreatmentPlan[] | null;
  advice?: SharedAdviceNote[] | null;
  followUps?: Array<{
    id: string;
    remind_on: string;
    title?: string;
    advice: string;
    status: string;
  }> | null;
  tone?: keyof typeof TONE | string;
  heading?: string;
}) {
  const t = TONE[tone] || TONE.emerald;
  const hasShare = Boolean(share && Object.keys(share).length);
  const planList = plans || [];
  const adviceList = advice || [];
  const reminderList = (followUps || []).filter((f) => f.status !== 'cancelled');
  const empty =
    !hasShare &&
    planList.length === 0 &&
    adviceList.length === 0 &&
    reminderList.length === 0;

  return (
    <div className={`rounded-2xl border ${t.border} bg-white p-4 space-y-4`}>
      <div className={`flex items-center gap-2 ${t.text}`}>
        <HeartPulse className="h-4 w-4" />
        <h2 className="text-sm font-black">{heading || t.title}</h2>
      </div>

      {empty ? (
        <p className="text-sm text-slate-500">
          Your practice has not shared a care summary yet. Ask the desk if you
          expected allergies, scripts, advice or medical aid here.
        </p>
      ) : null}

      {hasShare ? (
        <>
          {share!.allergies ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
              <Field label="Allergies" value={share!.allergies} alert />
            </div>
          ) : null}

          <dl className="space-y-2">
            <Field label="Current medication" value={share!.current_meds} />
            <Field
              label="Chronic conditions"
              value={share!.chronic_conditions}
            />
            {Array.isArray(share!.conditions) &&
            (share!.conditions as unknown[]).length > 0 ? (
              <div className="mb-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Conditions
                </dt>
                <dd className="mt-1 space-y-1.5">
                  {(
                    share!.conditions as Array<{
                      label?: string;
                      status?: string;
                      notes?: string;
                    }>
                  ).map((c, i) => (
                    <div
                      key={`${c.label || i}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-slate-900">
                        {c.label}
                        {c.status ? (
                          <span className="ml-2 text-[10px] font-black uppercase text-slate-400">
                            {c.status}
                          </span>
                        ) : null}
                      </p>
                      {c.notes ? (
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">
                          {c.notes}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
            <Field label="Diagnosis" value={share!.diagnosis_notes} />
            <Field label="Advice / care notes" value={share!.care_notes} />
            <Field label="Progress notes" value={share!.progress_notes} />
            <Field label="Treatment goals" value={share!.treatment_goals} />
            <Field label="Goals" value={share!.goals} />
            <Field
              label="Limitations"
              value={share!.functional_limitations}
            />
            <Field label="Avoid / cautions" value={share!.contraindications} />
            <Field label="Injury status" value={share!.injury_status} />
            <Field label="Injury areas" value={share!.injury_areas} />
            <Field label="Injury notes" value={share!.injury_notes} />
            <Field label="Pain score" value={share!.pain_score} />
            <Field label="Medical aid" value={share!.medical_aid} />
          </dl>

          {Array.isArray(share!.active_scripts) &&
          (share!.active_scripts as unknown[]).length > 0 ? (
            <div>
              <div className={`mb-1.5 flex items-center gap-1.5 ${t.text}`}>
                {tone === 'teal' ? (
                  <Activity className="h-3.5 w-3.5" />
                ) : (
                  <Pill className="h-3.5 w-3.5" />
                )}
                <p className="text-[10px] font-black uppercase tracking-wide">
                  {tone === 'teal' ? 'Your rehab' : 'Active scripts'}
                </p>
              </div>
              <ul className="space-y-1.5">
                {(share!.active_scripts as unknown[]).map((row, i) => {
                  const obj =
                    row && typeof row === 'object'
                      ? (row as {
                          title?: string;
                          line?: string;
                          instructions?: string | null;
                        })
                      : null;
                  return (
                    <li
                      key={i}
                      className={`rounded-xl px-3 py-2 text-sm text-slate-800 ${t.chip}`}
                    >
                      {obj ? (
                        <>
                          <p className="font-semibold">
                            {obj.line || obj.title || ''}
                          </p>
                          {obj.instructions ? (
                            <p className="mt-0.5 text-xs text-slate-600">
                              {obj.instructions}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        String(row)
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {Array.isArray(share!.client_notes) &&
          (share!.client_notes as unknown[]).length > 0 ? (
            <div>
              <div className={`mb-1.5 flex items-center gap-1.5 ${t.text}`}>
                <ClipboardList className="h-3.5 w-3.5" />
                <p className="text-[10px] font-black uppercase tracking-wide">
                  Notes from your clinician
                </p>
              </div>
              <ul className="space-y-1.5">
                {(
                  share!.client_notes as Array<{
                    id?: string;
                    body?: string;
                    at?: string;
                    author_name?: string | null;
                  }>
                ).map((n, i) => (
                  <li
                    key={n.id || i}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <p className="whitespace-pre-wrap text-slate-800">{n.body}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {[n.author_name, n.at ? String(n.at).slice(0, 10) : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(share!.shared_movements) &&
          (share!.shared_movements as unknown[]).length > 0 ? (
            <div>
              <div className={`mb-1.5 flex items-center gap-1.5 ${t.text}`}>
                <Activity className="h-3.5 w-3.5" />
                <p className="text-[10px] font-black uppercase tracking-wide">
                  Your movements
                </p>
              </div>
              <ul className="space-y-1.5">
                {(
                  share!.shared_movements as Array<{
                    id?: string;
                    name?: string;
                    overview?: string | null;
                    sets?: string | null;
                    reps?: string | null;
                    hold?: string | null;
                    frequency?: string | null;
                    notes?: string | null;
                    image_url?: string | null;
                    video_url?: string | null;
                  }>
                ).map((m, i) => (
                  <li
                    key={m.id || i}
                    className={`rounded-xl px-3 py-2 text-sm text-slate-800 ${t.chip}`}
                  >
                    {m.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.image_url}
                        alt=""
                        className="mb-2 h-28 w-full rounded-lg object-cover"
                      />
                    ) : null}
                    {m.video_url ? (
                      <video
                        src={m.video_url}
                        className="mb-2 h-36 w-full rounded-lg bg-black object-cover"
                        controls
                        muted
                        playsInline
                        loop
                      />
                    ) : null}
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-slate-600">
                      {[
                        m.sets && `${m.sets} sets`,
                        m.reps && `${m.reps} reps`,
                        m.hold,
                        m.frequency,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {m.overview ? (
                      <p className="mt-0.5 text-xs text-slate-600">{m.overview}</p>
                    ) : null}
                    {m.notes ? (
                      <p className="mt-0.5 text-xs text-slate-700">{m.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {reminderList.length > 0 ? (
        <div>
          <div className={`mb-1.5 flex items-center gap-1.5 ${t.text}`}>
            <Stethoscope className="h-3.5 w-3.5" />
            <p className="text-[10px] font-black uppercase tracking-wide">
              Your treatment reminders
            </p>
          </div>
          <ul className="space-y-2">
            {reminderList.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
              >
                <p className="text-[10px] font-bold uppercase text-amber-800">
                  {f.title || 'Check-in'} · {f.remind_on}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">
                  {f.advice}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {adviceList.length > 0 ? (
        <div>
          <div className={`mb-1.5 flex items-center gap-1.5 ${t.text}`}>
            <Stethoscope className="h-3.5 w-3.5" />
            <p className="text-[10px] font-black uppercase tracking-wide">
              Advice from your clinician
            </p>
          </div>
          <ul className="space-y-2">
            {adviceList.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-[10px] font-bold text-slate-400">
                  {[n.author_name, n.at ? n.at.slice(0, 10) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {n.body ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">
                    {n.body}
                  </p>
                ) : null}
                {n.plan ? (
                  <p className="mt-1 text-xs text-slate-600">
                    <span className="font-bold">Plan: </span>
                    {n.plan}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {planList.length > 0 ? (
        <div>
          <div className={`mb-1.5 flex items-center gap-1.5 ${t.text}`}>
            <ClipboardList className="h-3.5 w-3.5" />
            <p className="text-[10px] font-black uppercase tracking-wide">
              Your care plan
            </p>
          </div>
          <ul className="space-y-2">
            {planList.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-slate-200 px-3 py-2"
              >
                <p className="text-sm font-black text-slate-900">{p.title}</p>
                {p.goals ? (
                  <p className="mt-0.5 text-xs text-slate-600">{p.goals}</p>
                ) : null}
                {p.next_step?.title ? (
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    Next: {p.next_step.title}
                    {p.next_step.notes ? ` — ${p.next_step.notes}` : ''}
                  </p>
                ) : null}
                {(p.steps || []).length > 0 ? (
                  <ul className="mt-1.5 space-y-0.5">
                    {(p.steps || []).map((s, i) => (
                      <li key={s.id || i} className="text-[11px] text-slate-600">
                        <span className="font-bold uppercase">
                          {s.status || 'planned'}
                        </span>
                        {' · '}
                        {s.title}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-slate-400">
        Summary only — full charts stay with your clinicians.
      </p>
    </div>
  );
}