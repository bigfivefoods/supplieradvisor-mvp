'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  HEARD_ABOUT_OPTIONS,
  PARQ_QUESTIONS,
  parqYesCount,
  type FitParqAnswers,
} from '@/lib/fitness/member-contract';
import { SA_DEBIT_BANKS } from '@/lib/fitness/member-debit-bank';

type Plan = { id?: string; code: string; name: string; price_zar: number };

const inp =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950';

export default function GymOnboardPage() {
  const { token } = useParams() as { token: string };
  const search = useSearchParams();
  const [brand, setBrand] = useState('Gym');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const initialKind = search.get('kind');
  const [wantMember, setWantMember] = useState(
    initialKind !== 'private'
  );
  const [wantPrivate, setWantPrivate] = useState(
    initialKind === 'private' || initialKind === 'both'
  );
  const [parq, setParq] = useState<FitParqAnswers>({});
  const [form, setForm] = useState({
    name: '',
    id_number: '',
    phone: '',
    email: '',
    heard_about: 'FRIEND',
    employer_student_number: '',
    occupation: '',
    address: '',
    medical_aid: '',
    medical_aid_plan: '',
    emergency_contact: '',
    gp: '',
    date_of_birth: '',
    start_date: new Date().toISOString().slice(0, 10),
    parq_explanation: '',
    class_option: '',
    account_holder: '',
    account_type: 'cheque',
    account_number: '',
    bank_name: '',
    debit_amount_zar: '',
    signature_name: '',
    terms_accepted: false,
    parq_accepted: false,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/public/fitgraph?token=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gym not found');
        if (cancelled) return;
        setBrand(data.calendar?.brand || 'Gym');
        setPlans(data.calendar?.plans || data.shop?.plans || []);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Could not load gym');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const yesCount = useMemo(() => parqYesCount(parq), [parq]);
  const parqComplete = PARQ_QUESTIONS.every((q) => typeof parq[q.key] === 'boolean');

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.terms_accepted || !form.parq_accepted) {
      toast.error('Please tick both agreements');
      return;
    }
    if (!parqComplete) {
      toast.error('Please answer every health question');
      return;
    }
    if (yesCount > 0 && !form.parq_explanation.trim()) {
      toast.error('Please explain any Yes answers');
      return;
    }
    if (!form.signature_name.trim()) {
      toast.error('Type your full name as your signature');
      return;
    }
    if (!wantMember && !wantPrivate) {
      toast.error('Choose member, private client, or both');
      return;
    }
    const kinds = [
      ...(wantMember ? (['group'] as const) : []),
      ...(wantPrivate ? (['private'] as const) : []),
    ];
    setBusy(true);
    try {
      const res = await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'onboard_member',
          kind: kinds.length === 2 ? 'both' : kinds[0],
          kinds,
          ...form,
          parq,
          class_amount_zar: plans.find((p) => p.name === form.class_option)
            ?.price_zar,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit');
      toast.success(data.message || 'Submitted');
      setDone(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (done) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-black">Application received</h1>
        <p className="mt-2 text-sm text-slate-600">
          {brand} has your contract on file. The gym owner can see it on your
          member profile.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-gradient-to-b from-yellow-50 to-white px-4 py-8 dark:from-yellow-950 dark:to-black">
      <p className="text-[11px] font-black uppercase tracking-wide text-yellow-800">
        {brand} · GymAdvisor
      </p>
      <h1 className="text-2xl font-black">Membership application</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-yellow-100/80">
        Join as a member, a private client, or both. Health answers, bank
        details and signatures stay on your gym profile for the owner.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setWantMember((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-black ${
            wantMember
              ? 'border-yellow-500 bg-yellow-300 text-yellow-950'
              : 'border-slate-200 bg-white'
          }`}
        >
          Member
        </button>
        <button
          type="button"
          onClick={() => setWantPrivate((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-black ${
            wantPrivate
              ? 'border-yellow-500 bg-yellow-300 text-yellow-950'
              : 'border-slate-200 bg-white'
          }`}
        >
          Private client
        </button>
      </div>

      <div className="mt-6 space-y-3">
        <input
          className={inp}
          placeholder="Full name *"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inp}
            placeholder="ID / passport number"
            value={form.id_number}
            onChange={(e) =>
              setForm((f) => ({ ...f, id_number: e.target.value }))
            }
          />
          <label className="text-[10px] font-black uppercase text-slate-500">
            Date of birth
            <input
              className={inp + ' mt-1'}
              type="date"
              value={form.date_of_birth}
              onChange={(e) =>
                setForm((f) => ({ ...f, date_of_birth: e.target.value }))
              }
            />
          </label>
          <input
            className={inp}
            placeholder="Mobile number"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <input
          className={inp}
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[10px] font-black uppercase text-slate-500">
            How did you hear about us?
            <select
              className={inp + ' mt-1'}
              value={form.heard_about}
              onChange={(e) =>
                setForm((f) => ({ ...f, heard_about: e.target.value }))
              }
            >
              {HEARD_ABOUT_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase text-slate-500">
            Contract start
            <input
              className={inp + ' mt-1'}
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_date: e.target.value }))
              }
            />
          </label>
        </div>
        <input
          className={inp}
          placeholder="Employer / student number"
          value={form.employer_student_number}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              employer_student_number: e.target.value,
            }))
          }
        />
        <input
          className={inp}
          placeholder="Occupation"
          value={form.occupation}
          onChange={(e) =>
            setForm((f) => ({ ...f, occupation: e.target.value }))
          }
        />
        <input
          className={inp}
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inp}
            placeholder="Medical aid"
            value={form.medical_aid}
            onChange={(e) =>
              setForm((f) => ({ ...f, medical_aid: e.target.value }))
            }
          />
          <input
            className={inp}
            placeholder="Plan / scheme / number"
            value={form.medical_aid_plan}
            onChange={(e) =>
              setForm((f) => ({ ...f, medical_aid_plan: e.target.value }))
            }
          />
        </div>
        <input
          className={inp}
          placeholder="Emergency contact"
          value={form.emergency_contact}
          onChange={(e) =>
            setForm((f) => ({ ...f, emergency_contact: e.target.value }))
          }
        />
        <input
          className={inp}
          placeholder="GP & contact"
          value={form.gp}
          onChange={(e) => setForm((f) => ({ ...f, gp: e.target.value }))}
        />

        {wantMember ? (
          <div className="space-y-3 rounded-2xl border border-yellow-200 bg-yellow-50/60 p-3">
            <p className="text-xs font-black">Group class & debit order</p>
            <select
              className={inp}
              value={form.class_option}
              onChange={(e) =>
                setForm((f) => ({ ...f, class_option: e.target.value }))
              }
            >
              <option value="">Class option…</option>
              {plans.map((p) => (
                <option key={p.code} value={p.name}>
                  {p.name} · R{p.price_zar}
                </option>
              ))}
            </select>
            <input
              className={inp}
              placeholder="Account holder"
              value={form.account_holder}
              onChange={(e) =>
                setForm((f) => ({ ...f, account_holder: e.target.value }))
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className={inp}
                value={form.bank_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bank_name: e.target.value }))
                }
              >
                <option value="">Bank…</option>
                {SA_DEBIT_BANKS.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                className={inp}
                value={form.account_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, account_type: e.target.value }))
                }
              >
                <option value="cheque">Cheque / current</option>
                <option value="savings">Savings</option>
              </select>
            </div>
            <input
              className={inp}
              placeholder="Bank account number"
              value={form.account_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, account_number: e.target.value }))
              }
            />
            <input
              className={inp}
              placeholder="Debit amount (ZAR)"
              value={form.debit_amount_zar}
              onChange={(e) =>
                setForm((f) => ({ ...f, debit_amount_zar: e.target.value }))
              }
            />
            <p className="text-[11px] text-slate-600">
              You authorise the gym to collect the monthly membership from this
              account until you cancel in writing (20 working days).
            </p>
          </div>
        ) : null}

        {wantPrivate ? (
          <p className="rounded-2xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-950">
            Private client — the gym owner assigns your coach after this
            application.
          </p>
        ) : null}

        <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <p className="text-xs font-black">Health questionnaire (PAR-Q)</p>
          {PARQ_QUESTIONS.map((q) => (
            <fieldset key={q.key} className="text-sm">
              <legend className="mb-1 text-[13px]">{q.label}</legend>
              <label className="mr-4 font-bold">
                <input
                  type="radio"
                  className="mr-1"
                  checked={parq[q.key] === false}
                  onChange={() => setParq((p) => ({ ...p, [q.key]: false }))}
                />
                No
              </label>
              <label className="font-bold">
                <input
                  type="radio"
                  className="mr-1"
                  checked={parq[q.key] === true}
                  onChange={() => setParq((p) => ({ ...p, [q.key]: true }))}
                />
                Yes
              </label>
            </fieldset>
          ))}
          <textarea
            className={inp + ' min-h-[4.5rem]'}
            placeholder="If you answered Yes to one or more questions, please explain"
            value={form.parq_explanation}
            onChange={(e) =>
              setForm((f) => ({ ...f, parq_explanation: e.target.value }))
            }
          />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.terms_accepted}
            onChange={(e) =>
              setForm((f) => ({ ...f, terms_accepted: e.target.checked }))
            }
          />
          I agree to the terms of service.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.parq_accepted}
            onChange={(e) =>
              setForm((f) => ({ ...f, parq_accepted: e.target.checked }))
            }
          />
          I have read, understood and completed this questionnaire. Any questions
          I had were answered to my full satisfaction.
        </label>
        <input
          className={inp}
          placeholder="Type your full name as signature *"
          value={form.signature_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, signature_name: e.target.value }))
          }
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-yellow-950 disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </main>
  );
}
