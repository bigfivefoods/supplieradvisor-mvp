'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AdvisorExpandablePanel } from '@/components/advisors/AdvisorExpandablePanel';
import { PatientAilmentDesk } from '@/components/clinic/PatientAilmentDesk';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  formatZar,
  type MemberAccountCharge,
} from '@/lib/b2c/member-account-types';
import { goalsForClient } from '@/lib/fitness/fitgraph-relationship';
import type { FitClient, FitgraphStore } from '@/lib/fitness/fitgraph';
import {
  ageFromDob,
  memberBirthday,
  memberJoinTimeline,
  memberPersonalBests,
  monthlyStatements,
  nextOfKinLabel,
  passportFacts,
} from '@/lib/fitness/member-profile';
import {
  PARQ_QUESTIONS,
  parqYesCount,
} from '@/lib/fitness/member-contract';

type PostFn = (body: Record<string, unknown>) => Promise<unknown>;

function whenLabel(iso?: string | null): string {
  if (!iso) return '';
  const d = String(iso).slice(0, 10);
  return d;
}

export function GymMemberProfileDesk({
  client,
  store,
  post,
  saving,
  onRefresh,
}: {
  client: FitClient;
  store: FitgraphStore;
  post: PostFn;
  saving?: boolean;
  onRefresh?: () => void;
}) {
  const { companyId, withAuthJson } = useApiAuth();
  const [accountOpen, setAccountOpen] = useState(true);
  const [joinOpen, setJoinOpen] = useState(true);
  const [passportOpen, setPassportOpen] = useState(true);
  const [pbOpen, setPbOpen] = useState(true);
  const [contractOpen, setContractOpen] = useState(true);
  const [ratesOpen, setRatesOpen] = useState(true);
  const [agreedRate, setAgreedRate] = useState(
    client.agreed_rate_zar != null ? String(client.agreed_rate_zar) : ''
  );
  const [privateRate, setPrivateRate] = useState(
    client.private_rate_zar != null ? String(client.private_rate_zar) : ''
  );
  const [charges, setCharges] = useState<MemberAccountCharge[]>([]);
  const [accountLoading, setAccountLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ charges?: MemberAccountCharge[] }>(
      `/api/advisors/member-accounts?companyId=${companyId}&module=fitgraph`
    );
    setCharges(
      (data.charges || []).filter((c) => String(c.ref_id) === client.id)
    );
  }, [companyId, withAuthJson, client.id]);

  useEffect(() => {
    setAgreedRate(
      client.agreed_rate_zar != null ? String(client.agreed_rate_zar) : ''
    );
    setPrivateRate(
      client.private_rate_zar != null ? String(client.private_rate_zar) : ''
    );
  }, [client.id, client.agreed_rate_zar, client.private_rate_zar]);

  useEffect(() => {
    let cancelled = false;
    setAccountLoading(true);
    void loadAccounts()
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Could not load account');
        }
      })
      .finally(() => {
        if (!cancelled) setAccountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAccounts]);

  const facts = useMemo(() => passportFacts(client), [client]);
  const birthday = memberBirthday(client);
  const age = ageFromDob(birthday);
  const nok = nextOfKinLabel(client);
  const timeline = useMemo(
    () => memberJoinTimeline(store, client),
    [store, client]
  );
  const pbs = useMemo(
    () => memberPersonalBests(store, client.id),
    [store, client.id]
  );
  const goals = useMemo(
    () => goalsForClient(store, client.id),
    [store, client.id]
  );
  const statements = useMemo(() => monthlyStatements(charges), [charges]);
  const fromPwa = Boolean(client.platform_user_id || client.passport);

  return (
    <div className="space-y-3">
      <AdvisorExpandablePanel
        title="SA Member profile"
        description={
          fromPwa
            ? 'Pulled from their PWA passport — name, birthday, next of kin, address, health notes.'
            : 'Not linked to SA Member yet. Invite them and these fields fill in from their phone.'
        }
        open={passportOpen}
        onToggle={() => setPassportOpen((v) => !v)}
        accentClass="border-sky-200 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30"
        titleClass="text-sky-950 dark:text-sky-50"
        hintClass="text-sky-800/80 dark:text-sky-200/80"
      >
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Birthday
            </dt>
            <dd className="font-semibold tabular-nums">
              {birthday ? `${birthday}${age != null ? ` · ${age} yrs` : ''}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Next of kin
            </dt>
            <dd className="font-semibold">{nok || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Membership start
            </dt>
            <dd className="font-semibold tabular-nums">
              {client.start_date || '—'}
            </dd>
          </div>
        </dl>
        {facts.length ? (
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {f.label}
                </dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[12px] text-slate-500">
            No PWA passport on file yet. Birthday and next of kin above save
            from this desk.
          </p>
        )}
        {(client.family || []).filter((m) => m.active !== false).length ? (
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
              Household (from PWA)
            </p>
            <ul className="space-y-1 text-sm">
              {(client.family || [])
                .filter((m) => m.active !== false)
                .map((m) => (
                  <li key={m.id}>
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-[12px] text-slate-500">
                      {` · ${m.relationship}`}
                      {m.date_of_birth ? ` · ${m.date_of_birth}` : ''}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </AdvisorExpandablePanel>

      <AdvisorExpandablePanel
        title="Membership contract (owner only)"
        description="Group or private application, PAR-Q and signatures. Not shown on the member PWA."
        open={contractOpen}
        onToggle={() => setContractOpen((v) => !v)}
        accentClass="border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30"
        titleClass="text-rose-950 dark:text-rose-50"
        hintClass="text-rose-800/80 dark:text-rose-200/80"
      >
        {!(client.contracts || []).length ? (
          <p className="text-[12px] text-slate-500">
            No contract on file yet. Send the onboarding form from Classes.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-black uppercase">
                {client.contract_kind || client.contracts?.[0]?.kind || '—'}
              </span>
              {client.occupation ? ` · ${client.occupation}` : ''}
              {client.heard_about ? ` · heard via ${client.heard_about}` : ''}
            </p>
            {client.address ? (
              <p className="text-[12px]">{client.address}</p>
            ) : null}
            {client.gp_contact ? (
              <p className="text-[12px]">GP: {client.gp_contact}</p>
            ) : null}
            {(client.contracts || [])
              .slice()
              .reverse()
              .map((con) => (
                <div
                  key={con.id}
                  className="rounded-xl border border-rose-200 bg-white p-3 dark:border-rose-800 dark:bg-rose-950/40"
                >
                  <p className="text-[11px] font-black uppercase">
                    {con.kind} · {String(con.submitted_at || '').slice(0, 10)}
                  </p>
                  {con.class_option ? (
                    <p className="text-[12px]">
                      Class {con.class_option}
                      {con.debit_amount_zar
                        ? ` · debit R${con.debit_amount_zar}`
                        : ''}
                    </p>
                  ) : null}
                  <ul className="mt-2 space-y-1 text-[12px]">
                    {PARQ_QUESTIONS.map((q) => (
                      <li key={q.key}>
                        <span className="font-bold">
                          {con.parq?.[q.key] === true
                            ? 'Yes'
                            : con.parq?.[q.key] === false
                              ? 'No'
                              : '—'}
                        </span>{' '}
                        {q.label}
                      </li>
                    ))}
                  </ul>
                  {con.parq_explanation ? (
                    <p className="mt-2 text-[12px]">
                      <strong>Explain:</strong> {con.parq_explanation}
                    </p>
                  ) : null}
                  {parqYesCount(con.parq) > 0 ? (
                    <p className="mt-1 text-[11px] font-bold text-rose-800">
                      {parqYesCount(con.parq)} Yes answer(s)
                    </p>
                  ) : null}
                  {con.signature_name ? (
                    <p className="mt-2 text-[12px]">
                      Signed: {con.signature_name}
                    </p>
                  ) : null}
                  {(con.signature_urls || []).length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(con.signature_urls || []).map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt="Signature"
                          className="h-16 rounded-lg border border-slate-200 bg-white"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        )}
      </AdvisorExpandablePanel>

      <AdvisorExpandablePanel
        title="Join history"
        description="When they were added, joined on SA Member, and started classes."
        open={joinOpen}
        onToggle={() => setJoinOpen((v) => !v)}
        accentClass="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30"
        titleClass="text-yellow-950 dark:text-yellow-50"
        hintClass="text-yellow-800/80 dark:text-yellow-200/80"
      >
        {timeline.length === 0 ? (
          <p className="text-[12px] text-slate-500">No join events yet.</p>
        ) : (
          <ol className="space-y-2">
            {timeline.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-black/5 pb-2 last:border-0 dark:border-white/10"
              >
                <span className="w-24 shrink-0 text-[11px] font-bold tabular-nums text-slate-500">
                  {whenLabel(row.at)}
                </span>
                <span className="font-semibold text-sm">{row.title}</span>
                {row.note ? (
                  <span className="text-[11px] text-slate-500">{row.note}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </AdvisorExpandablePanel>

      <AdvisorExpandablePanel
        title="Agreed rates"
        description="Class membership rate and private PT rate. Calendar PT sessions use the private rate (editable per session)."
        open={ratesOpen}
        onToggle={() => setRatesOpen((v) => !v)}
        accentClass="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30"
        titleClass="text-yellow-950 dark:text-yellow-50"
        hintClass="text-yellow-800/80 dark:text-yellow-200/80"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-slate-600">
            Class / membership (ZAR)
            <input
              className="mt-0.5 w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm font-semibold dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-50"
              type="number"
              min={0}
              step="0.01"
              value={agreedRate}
              onChange={(e) => setAgreedRate(e.target.value)}
            />
          </label>
          <label className="text-[11px] font-bold text-slate-600">
            Private PT (ZAR)
            <input
              className="mt-0.5 w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm font-semibold dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-50"
              type="number"
              min={0}
              step="0.01"
              value={privateRate}
              onChange={(e) => setPrivateRate(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          className="mt-2 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-black text-slate-900 disabled:opacity-50"
          onClick={async () => {
            const parse = (raw: string) => {
              const t = raw.trim();
              if (!t) return null;
              const n = Number(t);
              return Number.isFinite(n) ? n : Number.NaN;
            };
            const agreed = parse(agreedRate);
            const priv = parse(privateRate);
            if (Number.isNaN(agreed as number) || Number.isNaN(priv as number)) {
              toast.error('Rates must be numbers');
              return;
            }
            await post({
              entity: 'clients',
              action: 'upsert',
              record: {
                id: client.id,
                agreed_rate_zar: agreed,
                private_rate_zar: priv,
              },
            });
            toast.success('Agreed rates saved');
            onRefresh?.();
          }}
        >
          Save rates
        </button>
      </AdvisorExpandablePanel>

      <AdvisorExpandablePanel
        title="Membership account"
        description="Monthly statements for this member. Raise or collect on Accounts."
        open={accountOpen}
        onToggle={() => setAccountOpen((v) => !v)}
        accentClass="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30"
        titleClass="text-emerald-950 dark:text-emerald-50"
        hintClass="text-emerald-800/80 dark:text-emerald-200/80"
      >
        {accountLoading ? (
          <p className="text-[12px] text-slate-500">Loading statements…</p>
        ) : statements.length === 0 ? (
          <p className="text-[12px] text-slate-500">
            No charges yet.{' '}
            <Link
              href="/dashboard/fitgraph/accounts"
              className="font-bold text-emerald-800 underline dark:text-emerald-300"
            >
              Raise this month on Accounts
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {statements.map((m) => (
              <div
                key={m.month}
                className="rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-800 dark:bg-emerald-950/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-black">{m.label}</p>
                  <p className="text-[12px] tabular-nums">
                    Charged {formatZar(m.charged_zar)}
                    {m.paid_zar > 0 ? ` · paid ${formatZar(m.paid_zar)}` : ''}
                    {m.open_zar > 0 ? ` · open ${formatZar(m.open_zar)}` : ''}
                  </p>
                </div>
                <ul className="mt-2 space-y-1 text-[12px]">
                  {m.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap justify-between gap-2"
                    >
                      <span>{item.description}</span>
                      <span className="tabular-nums font-semibold">
                        {formatZar(item.amount_zar)} · {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link
              href="/dashboard/fitgraph/accounts"
              className="text-[11px] font-bold text-emerald-800 underline dark:text-emerald-300"
            >
              Open Accounts
            </Link>
          </div>
        )}
      </AdvisorExpandablePanel>

      <PatientAilmentDesk
        module="gym"
        patientId={client.id}
        clinical={client.health}
        post={post}
        saving={saving}
        accent="yellow"
        entity="clients"
        healthKey="health"
        onSaved={() => onRefresh?.()}
      />

      <AdvisorExpandablePanel
        title="PBs & goals"
        description="Personal bests from goals and watch sessions on their PWA."
        open={pbOpen}
        onToggle={() => setPbOpen((v) => !v)}
        accentClass="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30"
        titleClass="text-amber-950 dark:text-amber-50"
        hintClass="text-amber-800/80 dark:text-amber-200/80"
      >
        {pbs.length === 0 && goals.length === 0 ? (
          <p className="text-[12px] text-slate-500">
            No PBs yet. Members log goals and watch sessions on their PWA.
          </p>
        ) : (
          <div className="space-y-3">
            {pbs.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {pbs.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40"
                  >
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      {p.label}
                    </p>
                    <p className="text-sm font-black tabular-nums">{p.value}</p>
                    {p.at ? (
                      <p className="text-[11px] text-slate-500">
                        {whenLabel(p.at)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {goals.length ? (
              <ul className="space-y-2 text-sm">
                {goals.map((g) => (
                  <li key={g.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40">
                    <div className="flex flex-wrap gap-x-2">
                      <span className="font-semibold">{g.title}</span>
                      <span className="text-[11px] text-slate-500">
                        {g.status}
                        {g.current_value != null
                          ? ` · now ${g.current_value}${g.unit ? ` ${g.unit}` : ''}`
                          : ''}
                        {g.target_value != null
                          ? ` · target ${g.target_value}`
                          : ''}
                      </span>
                    </div>
                    {(g.check_ins || []).length ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {(g.check_ins || [])
                          .slice(-4)
                          .map(
                            (c) =>
                              `${String(c.at).slice(0, 10)}: ${c.metric_value}`
                          )
                          .join(' · ')}
                      </p>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <input
                        className="input flex-1 !py-1 !px-2 !text-xs"
                        placeholder="Log actual"
                        defaultValue=""
                        id={`goal-actual-${g.id}`}
                      />
                      <button
                        type="button"
                        disabled={saving}
                        className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black text-white"
                        onClick={() => {
                          const el = document.getElementById(
                            `goal-actual-${g.id}`
                          ) as HTMLInputElement | null;
                          const value = String(el?.value || '').trim();
                          if (!value) {
                            toast.error('Enter an actual');
                            return;
                          }
                          void post({
                            action: 'log_goal',
                            goal_id: g.id,
                            value,
                          }).then(() => {
                            toast.success('Actual saved');
                            if (el) el.value = '';
                            onRefresh?.();
                          });
                        }}
                      >
                        Log
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </AdvisorExpandablePanel>
    </div>
  );
}
