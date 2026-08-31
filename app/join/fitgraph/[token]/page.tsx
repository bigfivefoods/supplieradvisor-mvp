'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  PARQ_QUESTIONS,
  parqYesCount,
  type FitParqAnswers,
} from '@/lib/fitness/member-contract';
import { SA_DEBIT_BANKS } from '@/lib/fitness/member-debit-bank';

// ─── Types ──────────────────────────────────────────────────────────────────

type Plan = { id?: string; code: string; name: string; price_zar: number };
type Lane = 'door' | 'new' | 'returning' | 'coach';

// ─── Helpers ────────────────────────────────────────────────────────────────

const inp =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950';

function storeToken(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* private mode */ }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function GymDoorPage() {
  const { token } = useParams() as { token: string };

  // ── Gym data ──────────────────────────────────────────────────────────────
  const [brand, setBrand] = useState('Gym');
  const [logoUrl, setLogoUrl] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [requiresDebitBank, setRequiresDebitBank] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Lane state ────────────────────────────────────────────────────────────
  const [lane, setLane] = useState<Lane>('door');
  const [wantMember, setWantMember] = useState(true);
  const [wantPrivate, setWantPrivate] = useState(false);

  // ── New member form ───────────────────────────────────────────────────────
  const [newForm, setNewForm] = useState({
    name: '',
    email: '',
    phone: '',
    id_number: '',
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
  const [parq, setParq] = useState<FitParqAnswers>({});
  const [showMore, setShowMore] = useState(false);
  const [moreForm, setMoreForm] = useState({
    occupation: '',
    address: '',
    medical_aid: '',
    medical_aid_plan: '',
    emergency_contact: '',
    gp: '',
    heard_about: 'FRIEND',
    date_of_birth: '',
    start_date: new Date().toISOString().slice(0, 10),
    employer_student_number: '',
  });
  const [busy, setBusy] = useState(false);

  // ── Returning / coach sign-in ─────────────────────────────────────────────
  const [signinEmail, setSigninEmail] = useState('');
  const [codeStep, setCodeStep] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [pinStep, setPinStep] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [portalPath, setPortalPath] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');

  // ── Load gym ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/public/fitgraph?token=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );
        const data = await res.json() as {
          error?: string;
          calendar?: { brand?: string; require_debit_bank?: boolean; plans?: Plan[] };
          shop?: { plans?: Plan[] };
          brand?: string;
          logo_url?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Gym not found');
        if (cancelled) return;
        setBrand(data.calendar?.brand || data.brand || 'Gym');
        setLogoUrl(data.logo_url || '');
        setRequiresDebitBank(Boolean(data.calendar?.require_debit_bank));
        setPlans(data.calendar?.plans || data.shop?.plans || []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load gym');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const submitNew = async () => {
    setError('');
    if (!newForm.name.trim()) return setError('Name is required');
    if (!newForm.email.trim() && !newForm.phone.trim()) return setError('Email or phone is required');
    if (!newForm.terms_accepted || !newForm.parq_accepted) return setError('Please tick both agreements');
    const yesCount = parqYesCount(parq);
    const parqComplete = PARQ_QUESTIONS.every((q) => typeof parq[q.key] === 'boolean');
    if (!parqComplete) return setError('Please answer every health question');
    if (yesCount > 0 && !newForm.parq_explanation.trim()) return setError('Please explain any Yes answers');
    if (!newForm.signature_name.trim()) return setError('Type your full name as your signature');
    if (!wantMember && !wantPrivate) return setError('Choose gym membership, private coaching, or both');
    const kinds: Array<'group' | 'private'> = [
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
          ...newForm,
          ...moreForm,
          parq,
          class_amount_zar: plans.find((p) => p.name === newForm.class_option)?.price_zar,
        }),
      });
      const data = await res.json() as { error?: string; portal_token?: string; portal_path?: string };
      if (!res.ok) throw new Error(data.error || 'Could not submit');
      if (data.portal_path) {
        storeToken('sa_fitgraph_member_token', data.portal_token || '');
        window.location.assign(data.portal_path);
      } else if (data.portal_token) {
        storeToken('sa_fitgraph_member_token', data.portal_token);
        window.location.assign(`/member/fitgraph/${encodeURIComponent(data.portal_token)}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async () => {
    setError('');
    if (!signinEmail.includes('@')) return setError('Enter a valid email address');
    setBusy(true);
    try {
      const res = await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'request_code', email: signinEmail, lane }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not send code');
      setCodeStep(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setError('');
    if (codeInput.length !== 6) return setError('Enter the 6-digit code from your email');
    setBusy(true);
    try {
      const res = await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'verify_code', email: signinEmail, code: codeInput, lane }),
      });
      const data = await res.json() as { error?: string; portal_token?: string; portal_path?: string; offer_pin?: boolean };
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      if (data.portal_token) storeToken('sa_fitgraph_member_token', data.portal_token);
      if (data.offer_pin) {
        setVerifiedToken(data.portal_token || '');
        setPortalPath(data.portal_path || '');
        setPinStep(true);
      } else if (data.portal_path) {
        window.location.assign(data.portal_path);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const savePin = async () => {
    setError('');
    if (!/^\d{4,6}$/.test(pinInput)) return setError('PIN must be 4–6 digits');
    setBusy(true);
    try {
      await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'set_pin', email: signinEmail, pin: pinInput, lane, portal_token: verifiedToken }),
      });
    } catch { /* PIN save is best-effort */ } finally {
      setBusy(false);
    }
    window.location.assign(portalPath);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const yesCount = parqYesCount(parq);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
      </div>
    );
  }

  // ── Door ──────────────────────────────────────────────────────────────────
  if (lane === 'door') {
    return (
      <main className="mx-auto min-h-dvh max-w-sm px-5 py-12 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brand} className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-300 text-2xl font-black text-yellow-950">
            {brand.slice(0, 2).toUpperCase()}
          </div>
        )}
        <h1 className="text-3xl font-black tracking-tight">{brand}</h1>
        {error ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => { setError(''); setLane('new'); }}
            className="w-full rounded-2xl bg-yellow-300 py-4 text-base font-black text-yellow-950"
          >
            I&apos;M NEW
            <span className="mt-0.5 block text-xs font-semibold opacity-70">
              Membership / coaching / both
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setError(''); setLane('returning'); }}
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 text-base font-black text-slate-800"
          >
            I TRAIN HERE
            <span className="mt-0.5 block text-xs font-semibold opacity-60">Returning member</span>
          </button>
          <button
            type="button"
            onClick={() => { setError(''); setLane('coach'); }}
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 text-base font-black text-slate-800"
          >
            I COACH HERE
            <span className="mt-0.5 block text-xs font-semibold opacity-60">Coach / trainer</span>
          </button>
        </div>
      </main>
    );
  }

  // ── New member ─────────────────────────────────────────────────────────────
  if (lane === 'new') {
    return (
      <main className="mx-auto min-h-dvh max-w-lg px-4 py-8">
        <button type="button" onClick={() => { setLane('door'); setError(''); }} className="mb-4 text-xs font-black text-slate-500">
          ← Back
        </button>
        <h1 className="text-2xl font-black">{brand}</h1>
        <p className="mb-4 text-sm text-slate-500">New member application</p>

        {/* Membership kind — step 0 on this same first page */}
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWantMember((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-black ${wantMember ? 'border-yellow-500 bg-yellow-300 text-yellow-950' : 'border-slate-200 bg-white'}`}
          >
            Gym membership
          </button>
          <button
            type="button"
            onClick={() => setWantPrivate((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-black ${wantPrivate ? 'border-yellow-500 bg-yellow-300 text-yellow-950' : 'border-slate-200 bg-white'}`}
          >
            Private coaching
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        <div className="space-y-3">
          <input className={inp} placeholder="Full name *" value={newForm.name}
            onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} />
          <input className={inp} type="email" placeholder="Email *" value={newForm.email}
            onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} />
          <input className={inp} placeholder="Mobile number" value={newForm.phone}
            onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} />
          <input className={inp} placeholder="ID / passport (optional)" value={newForm.id_number}
            onChange={(e) => setNewForm((f) => ({ ...f, id_number: e.target.value }))} />

          {/* Class picker */}
          {wantMember && plans.length > 0 ? (
            <select className={inp} value={newForm.class_option}
              onChange={(e) => setNewForm((f) => ({ ...f, class_option: e.target.value }))}>
              <option value="">Class option…</option>
              {plans.map((p) => (
                <option key={p.code} value={p.name}>{p.name} · R{p.price_zar}</option>
              ))}
            </select>
          ) : null}

          {/* Debit bank — only when gym requires it */}
          {requiresDebitBank && wantMember ? (
            <div className="space-y-3 rounded-2xl border border-yellow-200 bg-yellow-50/60 p-3">
              <p className="text-xs font-black">Bank / debit order</p>
              <input className={inp} placeholder="Account holder" value={newForm.account_holder}
                onChange={(e) => setNewForm((f) => ({ ...f, account_holder: e.target.value }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <select className={inp} value={newForm.bank_name}
                  onChange={(e) => setNewForm((f) => ({ ...f, bank_name: e.target.value }))}>
                  <option value="">Bank…</option>
                  {SA_DEBIT_BANKS.map((b) => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
                <select className={inp} value={newForm.account_type}
                  onChange={(e) => setNewForm((f) => ({ ...f, account_type: e.target.value }))}>
                  <option value="cheque">Cheque / current</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
              <input className={inp} placeholder="Account number" value={newForm.account_number}
                onChange={(e) => setNewForm((f) => ({ ...f, account_number: e.target.value }))} />
              <input className={inp} placeholder="Monthly amount (ZAR)" value={newForm.debit_amount_zar}
                onChange={(e) => setNewForm((f) => ({ ...f, debit_amount_zar: e.target.value }))} />
            </div>
          ) : null}

          {/* PAR-Q */}
          <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
            <p className="text-xs font-black">Health questionnaire (PAR-Q)</p>
            {PARQ_QUESTIONS.map((q) => (
              <fieldset key={q.key} className="text-sm">
                <legend className="mb-1 text-[13px]">{q.label}</legend>
                <label className="mr-4 font-bold">
                  <input type="radio" className="mr-1" checked={parq[q.key] === false}
                    onChange={() => setParq((p) => ({ ...p, [q.key]: false }))} />
                  No
                </label>
                <label className="font-bold">
                  <input type="radio" className="mr-1" checked={parq[q.key] === true}
                    onChange={() => setParq((p) => ({ ...p, [q.key]: true }))} />
                  Yes
                </label>
              </fieldset>
            ))}
            {yesCount > 0 ? (
              <textarea className={inp + ' min-h-[4.5rem]'}
                placeholder="Please explain any Yes answers"
                value={newForm.parq_explanation}
                onChange={(e) => setNewForm((f) => ({ ...f, parq_explanation: e.target.value }))} />
            ) : null}
          </div>

          {/* More details (hidden by default) */}
          <button type="button" onClick={() => setShowMore((v) => !v)}
            className="text-xs font-black text-slate-500 underline">
            {showMore ? 'Hide details' : 'More details (occupation, address, medical aid, GP…)'}
          </button>
          {showMore ? (
            <div className="space-y-3">
              <input className={inp} placeholder="Occupation" value={moreForm.occupation}
                onChange={(e) => setMoreForm((f) => ({ ...f, occupation: e.target.value }))} />
              <input className={inp} placeholder="Address" value={moreForm.address}
                onChange={(e) => setMoreForm((f) => ({ ...f, address: e.target.value }))} />
              <input className={inp} placeholder="Employer / student number" value={moreForm.employer_student_number}
                onChange={(e) => setMoreForm((f) => ({ ...f, employer_student_number: e.target.value }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inp} placeholder="Medical aid" value={moreForm.medical_aid}
                  onChange={(e) => setMoreForm((f) => ({ ...f, medical_aid: e.target.value }))} />
                <input className={inp} placeholder="Plan / number" value={moreForm.medical_aid_plan}
                  onChange={(e) => setMoreForm((f) => ({ ...f, medical_aid_plan: e.target.value }))} />
              </div>
              <input className={inp} placeholder="Emergency contact" value={moreForm.emergency_contact}
                onChange={(e) => setMoreForm((f) => ({ ...f, emergency_contact: e.target.value }))} />
              <input className={inp} placeholder="GP & contact" value={moreForm.gp}
                onChange={(e) => setMoreForm((f) => ({ ...f, gp: e.target.value }))} />
              <label className="text-[10px] font-black uppercase text-slate-500">
                Date of birth
                <input className={inp + ' mt-1'} type="date" value={moreForm.date_of_birth}
                  onChange={(e) => setMoreForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
              </label>
              <label className="text-[10px] font-black uppercase text-slate-500">
                Contract start
                <input className={inp + ' mt-1'} type="date" value={moreForm.start_date}
                  onChange={(e) => setMoreForm((f) => ({ ...f, start_date: e.target.value }))} />
              </label>
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={newForm.terms_accepted}
              onChange={(e) => setNewForm((f) => ({ ...f, terms_accepted: e.target.checked }))} />
            I agree to the terms of service.
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={newForm.parq_accepted}
              onChange={(e) => setNewForm((f) => ({ ...f, parq_accepted: e.target.checked }))} />
            I have read and completed this health questionnaire.
          </label>
          <input className={inp} placeholder="Type your full name as signature *"
            value={newForm.signature_name}
            onChange={(e) => setNewForm((f) => ({ ...f, signature_name: e.target.value }))} />
          <button type="button" disabled={busy} onClick={() => void submitNew()}
            className="w-full rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-yellow-950 disabled:opacity-50">
            {busy ? 'Submitting…' : 'Join ' + brand}
          </button>
        </div>
      </main>
    );
  }

  // ── Returning / coach sign-in ──────────────────────────────────────────────
  const isCoachLane = lane === 'coach';

  if (pinStep) {
    return (
      <main className="mx-auto min-h-dvh max-w-sm px-5 py-12">
        <h1 className="text-2xl font-black">{brand}</h1>
        <p className="mt-1 text-sm text-slate-500">Set a quick PIN for this phone (optional)</p>
        {error ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <input className={inp + ' mt-4'} type="number" inputMode="numeric" maxLength={6}
          placeholder="4–6 digit PIN" value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <div className="mt-3 flex gap-3">
          <button type="button" disabled={busy} onClick={() => void savePin()}
            className="flex-1 rounded-xl bg-yellow-400 py-3 text-sm font-black text-yellow-950 disabled:opacity-50">
            {busy ? '…' : 'Save PIN'}
          </button>
          <button type="button" onClick={() => window.location.assign(portalPath)}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-black text-slate-700">
            Skip
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-sm px-5 py-12">
      <button type="button" onClick={() => { setLane('door'); setError(''); setCodeStep(false); }}
        className="mb-4 text-xs font-black text-slate-500">
        ← Back
      </button>
      <h1 className="text-2xl font-black">{brand}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isCoachLane ? 'Coach sign-in' : 'Member sign-in'}
      </p>
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {!codeStep ? (
        <>
          <input className={inp + ' mt-4'} type="email" placeholder="Your email address"
            value={signinEmail} onChange={(e) => setSigninEmail(e.target.value)} />
          <button type="button" disabled={busy} onClick={() => void requestCode()}
            className="mt-3 w-full rounded-xl bg-yellow-400 py-3 text-sm font-black text-yellow-950 disabled:opacity-50">
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-600">
            We emailed a 6-digit code to <strong>{signinEmail}</strong>.
          </p>
          <input className={inp + ' mt-3 text-center text-xl tracking-widest'} inputMode="numeric"
            maxLength={6} placeholder="000000" value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button type="button" disabled={busy} onClick={() => void verifyCode()}
            className="mt-3 w-full rounded-xl bg-yellow-400 py-3 text-sm font-black text-yellow-950 disabled:opacity-50">
            {busy ? 'Checking…' : 'Open app'}
          </button>
          <button type="button" onClick={() => { setCodeStep(false); setCodeInput(''); setError(''); }}
            className="mt-2 w-full text-center text-xs text-slate-500 underline">
            Resend code
          </button>
        </>
      )}
    </main>
  );
}

