'use client';

/**
 * School kitchen food safety — CoA (R638) passport + monthly self-audit.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import type {
  CoaStatus,
  KitchenSafetyPassport,
  R638Answer,
  R638ItemId,
  SafetyBand,
} from '@/lib/schools/kitchen-safety';

type ChecklistItem = { id: R638ItemId; label: string; guidance: string };

export default function KitchenSafetyPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function bandClass(b?: SafetyBand | null) {
  if (b === 'green')
    return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100';
  if (b === 'amber')
    return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100';
  if (b === 'red')
    return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<'school' | 'agency'>('school');
  const [passport, setPassport] = useState<KitchenSafetyPassport | null>(null);
  const [risk, setRisk] = useState<{
    band: SafetyBand;
    label: string;
    reasons: string[];
    coa_status: CoaStatus;
  } | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [auditItems, setAuditItems] = useState<
    Partial<Record<R638ItemId, R638Answer>>
  >({});
  const [auditNotes, setAuditNotes] = useState('');
  const [audits, setAudits] = useState<
    Array<{ id: string; audited_at: string; score: number; band: string }>
  >([]);
  const [register, setRegister] = useState<{
    summary?: Record<string, number>;
    rows?: Array<Record<string, unknown>>;
    policy?: Record<string, unknown>;
  } | null>(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try agency register first
      const regRes = await fetch(
        `/api/schools/kitchen-safety?companyId=${companyId}&view=register&filter=${encodeURIComponent(filter)}`,
        { cache: 'no-store' }
      );
      if (regRes.ok) {
        const data = await regRes.json();
        if (data.role === 'agency') {
          setRole('agency');
          setRegister(data);
          setChecklist(data.checklist || []);
          setLoading(false);
          return;
        }
      }
      const res = await fetch(
        `/api/schools/kitchen-safety?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRole('school');
      setPassport(data.passport || null);
      setRisk(data.risk || null);
      setChecklist(data.checklist || []);
      setAudits(data.audits || []);
      const last = (data.audits || [])[0];
      if (last?.items) setAuditItems(last.items);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePassport = async () => {
    if (!passport) return;
    setSaving(true);
    try {
      const res = await fetch('/api/schools/kitchen-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'save_passport',
          passport,
          attest: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setPassport(data.passport);
      setRisk(data.risk);
      toast.success(data.message || 'Passport saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveAudit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/schools/kitchen-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'self_audit',
          items: auditItems,
          notes: auditNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed');
      setPassport(data.passport);
      setRisk(data.risk);
      toast.success(data.message || 'Self-audit saved');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Audit failed');
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async (claim_gate: 'soft' | 'hard') => {
    setSaving(true);
    try {
      const res = await fetch('/api/schools/kitchen-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'save_policy', claim_gate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Claim gate set to ${claim_gate}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SchoolsPage>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      </SchoolsPage>
    );
  }

  if (role === 'agency' && register) {
    const s = register.summary || {};
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="Kitchen safety register"
          titleAccent="R638 · CoA"
          description="DBE/PEU view of Certificate of Acceptability and R638 kitchen risk across linked schools — for audits and remediation."
          mode="agency"
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          }
        />
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: 'Schools', v: s.schools ?? 0 },
            { l: 'Valid CoA %', v: `${s.valid_coa_pct ?? 0}%` },
            { l: 'No CoA', v: s.none_coa ?? 0 },
            { l: 'Red kitchens', v: s.red ?? 0 },
          ].map((x) => (
            <div
              key={x.l}
              className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3 dark:border-violet-800 dark:bg-violet-950"
            >
              <div className="text-[10px] font-black uppercase text-violet-700 dark:text-violet-300">
                {x.l}
              </div>
              <div className="text-xl font-black tabular-nums">{x.v}</div>
            </div>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {['all', 'red', 'no_coa', 'expired', 'amber'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                filter === f
                  ? 'border-violet-600 bg-violet-600 text-white'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
          <button
            type="button"
            disabled={saving}
            className="ml-auto rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold"
            onClick={() => void savePolicy('soft')}
          >
            Claims: soft gate
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-bold"
            onClick={() => void savePolicy('hard')}
          >
            Claims: hard gate
          </button>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">School</th>
                <th className="px-3 py-2">District</th>
                <th className="px-3 py-2">CoA</th>
                <th className="px-3 py-2">R638</th>
                <th className="px-3 py-2">PIC</th>
                <th className="px-3 py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {(register.rows || []).map((r) => (
                <tr
                  key={String(r.school_profile_id)}
                  className="border-b border-slate-100"
                >
                  <td className="px-3 py-2 font-semibold">
                    {String(r.school_name)}
                    {r.emis_number ? (
                      <div className="text-[10px] text-slate-400">
                        EMIS {String(r.emis_number)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">{String(r.district || '—')}</td>
                  <td className="px-3 py-2 text-xs font-bold uppercase">
                    {String(r.coa_status)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.r638_score != null ? `${r.r638_score}%` : '—'}{' '}
                    <span className="uppercase opacity-70">
                      {String(r.r638_band || '')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{String(r.pic_name || '—')}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${bandClass(r.risk_band as SafetyBand)}`}
                    >
                      {String(r.risk_band)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Headline KPI vs News24 signal: track <strong>Valid CoA %</strong> by
          district. Soft gate shows risk on claims; hard gate blocks submit.
        </p>
      </SchoolsPage>
    );
  }

  // School passport UI
  const p = passport;
  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Kitchen food safety"
        titleAccent="R638 · CoA"
        description="Certificate of Acceptability, Person in Charge, monthly R638 self-audit, and PEU verification — legal kitchen compliance for NSNP."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        }
      />

      {risk ? (
        <div
          className={`mb-4 rounded-3xl border px-4 py-3 ${bandClass(risk.band)}`}
        >
          <div className="flex items-start gap-2">
            {risk.band === 'green' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-black">{risk.label}</p>
              {risk.reasons.length ? (
                <ul className="mt-1 list-inside list-disc text-xs opacity-90">
                  {risk.reasons.slice(0, 6).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs opacity-80">
                  CoA valid and R638 self-audit green — keep daily logs on serve
                  day.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {p ? (
        <div className="mb-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
          <h3 className="text-sm font-black">Certificate of Acceptability (CoA)</h3>
          <p className="text-[11px] text-slate-500">
            Issued by municipal Environmental Health under Regulation R638. Without
            a valid CoA for this kitchen, food handling is not legally compliant.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-bold">
              CoA status
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={p.coa_status || 'none'}
                onChange={(e) =>
                  setPassport({
                    ...p,
                    coa_status: e.target.value as CoaStatus,
                  })
                }
              >
                <option value="none">None / never issued</option>
                <option value="applied">Applied (awaiting EHP)</option>
                <option value="valid">Valid</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
            </label>
            <label className="text-xs font-bold">
              CoA number
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={p.coa_number || ''}
                onChange={(e) =>
                  setPassport({ ...p, coa_number: e.target.value })
                }
              />
            </label>
            <label className="text-xs font-bold">
              Issuing municipality
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={p.coa_municipality || ''}
                onChange={(e) =>
                  setPassport({ ...p, coa_municipality: e.target.value })
                }
              />
            </label>
            <label className="text-xs font-bold">
              Expiry date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={String(p.coa_expires_on || '').slice(0, 10)}
                onChange={(e) =>
                  setPassport({ ...p, coa_expires_on: e.target.value })
                }
              />
            </label>
            <label className="text-xs font-bold sm:col-span-2">
              CoA document URL (upload via Documents or paste link)
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="https://…"
                value={p.coa_file_url || ''}
                onChange={(e) =>
                  setPassport({ ...p, coa_file_url: e.target.value })
                }
              />
            </label>
          </div>

          <h3 className="pt-2 text-sm font-black">Person in Charge (R638)</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-bold">
              Name
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={p.pic_name || ''}
                onChange={(e) =>
                  setPassport({ ...p, pic_name: e.target.value })
                }
              />
            </label>
            <label className="text-xs font-bold">
              Phone
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={p.pic_phone || ''}
                onChange={(e) =>
                  setPassport({ ...p, pic_phone: e.target.value })
                }
              />
            </label>
            <label className="text-xs font-bold">
              Hygiene training date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={String(p.pic_training_at || '').slice(0, 10)}
                onChange={(e) =>
                  setPassport({ ...p, pic_training_at: e.target.value })
                }
              />
            </label>
            <label className="text-xs font-bold">
              Kitchen type
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={p.kitchen_type || 'school_kitchen'}
                onChange={(e) =>
                  setPassport({
                    ...p,
                    kitchen_type: e.target.value as KitchenSafetyPassport['kitchen_type'],
                  })
                }
              >
                <option value="school_kitchen">School kitchen</option>
                <option value="container">Container kitchen</option>
                <option value="satellite">Satellite / satellite prep</option>
                <option value="shared">Shared facility</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-bold">
            {(
              [
                ['water_ok', 'Water OK'],
                ['power_ok', 'Power OK'],
                ['cold_storage_ok', 'Cold storage OK'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p[k] === true}
                  onChange={(e) =>
                    setPassport({ ...p, [k]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void savePassport()}
            className="btn-primary inline-flex items-center gap-1.5 !py-2 !px-4 text-sm"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save passport (principal attest)
          </button>
        </div>
      ) : null}

      <div className="mb-6 space-y-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h3 className="text-sm font-black">Monthly R638 self-audit</h3>
        <p className="text-[11px] text-slate-500">
          Complete monthly. Red scores open a compliance item and raise risk on
          the DBE kitchen register.
        </p>
        <ul className="space-y-2">
          {checklist.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-slate-100 px-3 py-2 dark:border-slate-800"
            >
              <div className="text-sm font-semibold">{c.label}</div>
              <p className="text-[11px] text-slate-500">{c.guidance}</p>
              <div className="mt-2 flex gap-2">
                {(['yes', 'no', 'na'] as R638Answer[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() =>
                      setAuditItems((prev) => ({ ...prev, [c.id]: a }))
                    }
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${
                      auditItems[c.id] === a
                        ? a === 'yes'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : a === 'no'
                            ? 'border-rose-600 bg-rose-600 text-white'
                            : 'border-slate-600 bg-slate-600 text-white'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <textarea
          className="min-h-[4rem] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Notes / remediation plan"
          value={auditNotes}
          onChange={(e) => setAuditNotes(e.target.value)}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveAudit()}
          className="btn-primary !py-2 !px-4 text-sm"
        >
          Save self-audit
        </button>
        {audits.length > 0 ? (
          <div className="text-[11px] text-slate-500">
            Last audits:{' '}
            {audits
              .slice(0, 3)
              .map(
                (a) =>
                  `${String(a.audited_at).slice(0, 10)} · ${a.score}% ${a.band}`
              )
              .join(' · ')}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/dashboard/schools/serve-day" className="btn-secondary !py-1.5 !px-3">
          Serve day + daily micro-log
        </Link>
        <Link href="/dashboard/schools/compliance" className="btn-secondary !py-1.5 !px-3">
          Compliance events
        </Link>
        <Link href="/dashboard/schools/claims" className="btn-secondary !py-1.5 !px-3">
          Claims (kitchen risk shown)
        </Link>
      </div>
      <p className="mt-4 flex items-start gap-2 text-[11px] text-slate-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        Only ~18% of schools in six provinces met legal food-handling requirements
        (News24, Aug 2026). Valid CoA + R638 self-audit is the programme baseline.
      </p>
    </SchoolsPage>
  );
}
