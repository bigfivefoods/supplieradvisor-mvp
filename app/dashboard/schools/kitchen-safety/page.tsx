'use client';

/**
 * School kitchen food safety — CoA (R638) passport + monthly self-audit.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  X,
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
  KitchenMonthlyAudit,
  KitchenRegisterRow,
  KitchenSafetyPassport,
  R638Answer,
  R638ItemId,
  SafetyBand,
} from '@/lib/schools/kitchen-safety';
import {
  kitchenSafetyRollups,
  kitchenSafetySummary,
} from '@/lib/schools/kitchen-safety';

type ChecklistItem = { id: R638ItemId; label: string; guidance: string };

type CalendarCell = {
  date: string;
  inMonth: boolean;
  audit: KitchenMonthlyAudit | null;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function KitchenSafetyPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function csv(v: unknown) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
  const [auditByName, setAuditByName] = useState('');
  const [audits, setAudits] = useState<
    Array<{ id: string; audited_at: string; score: number; band: string }>
  >([]);
  const [monthlyAudits, setMonthlyAudits] = useState<KitchenMonthlyAudit[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<Record<string, unknown> | null>(
    null
  );
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calendarWeeks, setCalendarWeeks] = useState<CalendarCell[][]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    now.toISOString().slice(0, 10)
  );
  const [selectedMonthlyId, setSelectedMonthlyId] = useState<string | null>(
    null
  );
  const [register, setRegister] = useState<{
    summary?: Record<string, number | null>;
    rows?: KitchenRegisterRow[];
    policy?: Record<string, unknown>;
    facets?: {
      provinces: string[];
      districts: string[];
      circuits: string[];
      municipalities: string[];
      quintiles: number[];
    };
  } | null>(null);
  const [filter, setFilter] = useState('all');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [circuit, setCircuit] = useState('');
  const [quintile, setQuintile] = useState('');
  const [coa, setCoa] = useState('');
  const [peu, setPeu] = useState('');
  const [q, setQ] = useState('');
  const [sliceGroup, setSliceGroup] = useState<
    'district' | 'province' | 'circuit' | 'coa' | 'risk' | 'audit'
  >('district');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try agency register first
      const regRes = await fetch(
        `/api/schools/kitchen-safety?companyId=${companyId}&view=register`,
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
        `/api/schools/kitchen-safety?companyId=${companyId}&year=${calYear}&month=${calMonth}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRole('school');
      setPassport(data.passport || null);
      setRisk(data.risk || null);
      setChecklist(data.checklist || []);
      setAudits(data.audits || []);
      setMonthlyAudits(data.monthly_audits || []);
      setMonthlyStats(data.monthly_stats || null);
      setCalendarWeeks(data.calendar?.weeks || []);
      if (data.calendar?.year) setCalYear(Number(data.calendar.year));
      if (data.calendar?.month) setCalMonth(Number(data.calendar.month));
      const last = (data.audits || [])[0];
      if (last?.items) setAuditItems(last.items);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, calYear, calMonth]);

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

  const scheduleSelectedDay = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/schools/kitchen-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'schedule_monthly_audit',
          planned_date: selectedDate,
          monthly_audit_id: selectedMonthlyId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Schedule failed');
      toast.success(data.message || 'Scheduled');
      setSelectedMonthlyId(data.monthly_audit?.id || null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Schedule failed');
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
          action: 'complete_monthly_audit',
          planned_date: selectedDate,
          monthly_audit_id: selectedMonthlyId || undefined,
          completed_date: selectedDate,
          items: auditItems,
          notes: auditNotes,
          by_name: auditByName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed');
      setPassport(data.passport);
      setRisk(data.risk);
      toast.success(data.message || 'Monthly audit saved');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Audit failed');
    } finally {
      setSaving(false);
    }
  };

  const selectCalendarDay = (cell: CalendarCell) => {
    setSelectedDate(cell.date);
    setSelectedMonthlyId(cell.audit?.id || null);
    if (cell.audit?.items) {
      setAuditItems(cell.audit.items as Partial<Record<R638ItemId, R638Answer>>);
    }
    if (cell.audit?.notes) setAuditNotes(String(cell.audit.notes));
    if (cell.audit?.by_name) setAuditByName(String(cell.audit.by_name));
  };

  const shiftMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setCalMonth(m);
    setCalYear(y);
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

  const allRows = register?.rows || [];
  const slicedRows = useMemo(() => {
    let list = allRows;
    const p = province.trim().toLowerCase();
    const d = district.trim().toLowerCase();
    const c = circuit.trim().toLowerCase();
    const qq = q.trim().toLowerCase();
    if (p) {
      list = list.filter((r) => String(r.province || '').toLowerCase() === p);
    }
    if (d) {
      list = list.filter((r) => String(r.district || '').toLowerCase() === d);
    }
    if (c) {
      list = list.filter((r) => String(r.circuit || '').toLowerCase() === c);
    }
    if (quintile) {
      list = list.filter((r) => String(r.quintile || '') === quintile);
    }
    if (coa) {
      list = list.filter((r) => String(r.coa_status || '') === coa);
    }
    if (peu) {
      list = list.filter(
        (r) => String(r.peu_verify_status || 'none') === peu
      );
    }
    if (filter === 'red') list = list.filter((r) => r.risk_band === 'red');
    else if (filter === 'amber')
      list = list.filter((r) => r.risk_band === 'amber');
    else if (filter === 'green')
      list = list.filter((r) => r.risk_band === 'green');
    else if (filter === 'no_coa')
      list = list.filter((r) => r.coa_status === 'none');
    else if (filter === 'expired')
      list = list.filter((r) => r.coa_status === 'expired');
    else if (filter === 'audit_overdue')
      list = list.filter((r) => r.monthly_audit_status === 'overdue');
    else if (filter === 'audit_missing')
      list = list.filter(
        (r) => !r.monthly_audit_status || r.monthly_audit_status === 'none'
      );
    if (qq) {
      list = list.filter((r) => {
        const hay = [
          r.school_name,
          r.emis_number,
          r.province,
          r.district,
          r.circuit,
          r.cmc,
          r.local_municipality,
          r.pic_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(qq);
      });
    }
    return list;
  }, [
    allRows,
    province,
    district,
    circuit,
    quintile,
    coa,
    peu,
    filter,
    q,
  ]);

  const sliceSummary = useMemo(
    () => kitchenSafetySummary(slicedRows),
    [slicedRows]
  );
  const rollups = useMemo(
    () => kitchenSafetyRollups(slicedRows),
    [slicedRows]
  );
  const hasSlice =
    Boolean(province || district || circuit || quintile || coa || peu || q.trim()) ||
    filter !== 'all';

  const sliceFacets = useMemo(() => {
    const base = province
      ? allRows.filter(
          (r) =>
            String(r.province || '').toLowerCase() === province.toLowerCase()
        )
      : allRows;
    const inDistrict = district
      ? base.filter(
          (r) =>
            String(r.district || '').toLowerCase() === district.toLowerCase()
        )
      : base;
    const uniq = (vals: Array<string | null | undefined>) =>
      [...new Set(vals.map((v) => String(v || '').trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      );
    return {
      provinces: uniq(allRows.map((r) => r.province)),
      districts: uniq(base.map((r) => r.district)),
      circuits: uniq(inDistrict.map((r) => r.circuit)),
      quintiles: [
        ...new Set(
          allRows
            .map((r) => r.quintile)
            .filter((n): n is number => n != null && n >= 1 && n <= 5)
        ),
      ].sort((a, b) => a - b),
    };
  }, [allRows, province, district]);

  const clearSlice = () => {
    setProvince('');
    setDistrict('');
    setCircuit('');
    setQuintile('');
    setCoa('');
    setPeu('');
    setQ('');
    setFilter('all');
  };

  const downloadSliceCsv = () => {
    const header = [
      'school',
      'emis',
      'province',
      'district',
      'circuit',
      'quintile',
      'coa',
      'r638_score',
      'r638_band',
      'monthly_audit',
      'monthly_score',
      'pic',
      'peu_verify',
      'risk',
    ];
    const lines = [
      header.join(','),
      ...slicedRows.map((r) =>
        [
          csv(r.school_name),
          csv(r.emis_number),
          csv(r.province),
          csv(r.district),
          csv(r.circuit),
          r.quintile ?? '',
          csv(r.coa_status),
          r.r638_score ?? '',
          csv(r.r638_band),
          csv(r.monthly_audit_status),
          r.monthly_audit_score ?? '',
          csv(r.pic_name),
          csv(r.peu_verify_status),
          csv(r.risk_band),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kitchen-safety-slice-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    const s = sliceSummary;
    const groupRows =
      sliceGroup === 'province'
        ? rollups.byProvince
        : sliceGroup === 'circuit'
          ? rollups.byCircuit
          : sliceGroup === 'coa'
            ? rollups.byCoa
            : sliceGroup === 'risk'
              ? rollups.byRisk
              : sliceGroup === 'audit'
                ? rollups.byAudit
                : rollups.byDistrict;
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="Kitchen safety register"
          titleAccent="R638 · CoA"
          description="Slice CoA, R638 and monthly audits by province, district, circuit and quintile. Claim gate applies across the programme."
          mode="agency"
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadSliceCsv}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="btn-secondary !py-2 !px-3 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          }
        />

        <div className="mb-4 rounded-3xl border border-sky-200 bg-sky-50/80 p-4 dark:!border-sky-400 dark:!bg-sky-950">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
            <Filter className="h-3.5 w-3.5" /> Slice &amp; dice
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Province
              <select
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setDistrict('');
                  setCircuit('');
                }}
                className="mt-0.5 block min-w-[9rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
              >
                <option value="">All</option>
                {sliceFacets.provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              District
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setCircuit('');
                }}
                className="mt-0.5 block min-w-[9rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
              >
                <option value="">All</option>
                {sliceFacets.districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Circuit
              <select
                value={circuit}
                onChange={(e) => setCircuit(e.target.value)}
                className="mt-0.5 block min-w-[8rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
              >
                <option value="">All</option>
                {sliceFacets.circuits.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Quintile
              <select
                value={quintile}
                onChange={(e) => setQuintile(e.target.value)}
                className="mt-0.5 block min-w-[5rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
              >
                <option value="">All</option>
                {sliceFacets.quintiles.map((qn) => (
                  <option key={qn} value={String(qn)}>
                    Q{qn}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              CoA
              <select
                value={coa}
                onChange={(e) => setCoa(e.target.value)}
                className="mt-0.5 block min-w-[7rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="valid">Valid</option>
                <option value="none">None</option>
                <option value="applied">Applied</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-400">
              PEU verify
              <select
                value={peu}
                onChange={(e) => setPeu(e.target.value)}
                className="mt-0.5 block min-w-[8rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="verified">Verified</option>
                <option value="conditional">Conditional</option>
                <option value="noncompliant">Non-compliant</option>
                <option value="none">Not verified</option>
              </select>
            </label>
            <label className="min-w-[10rem] flex-1 text-[10px] font-bold uppercase text-slate-400">
              Search
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="School, EMIS, PIC…"
                className="mt-0.5 block w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
            </label>
            {hasSlice ? (
              <button
                type="button"
                onClick={clearSlice}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            {hasSlice ? 'Slice' : 'Programme'}:{' '}
            <strong>{s.schools.toLocaleString('en-ZA')}</strong> of{' '}
            {(register.summary?.schools ?? allRows.length).toLocaleString('en-ZA')}{' '}
            schools · Valid CoA <strong>{s.valid_coa_pct}%</strong> · Red{' '}
            <strong>{s.red}</strong>
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { l: 'Schools', v: s.schools ?? 0 },
            { l: 'Valid CoA %', v: `${s.valid_coa_pct ?? 0}%` },
            { l: 'No CoA', v: s.none_coa ?? 0 },
            { l: 'Red kitchens', v: s.red ?? 0 },
            {
              l: 'Month audits done',
              v: `${s.monthly_audit_done_pct ?? 0}%`,
            },
            { l: 'Month overdue', v: s.monthly_audit_overdue ?? 0 },
            { l: 'Month missing', v: s.monthly_audit_missing ?? 0 },
            {
              l: 'Month avg score',
              v:
                s.monthly_audit_avg_score != null
                  ? `${s.monthly_audit_avg_score}%`
                  : '—',
            },
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
          {[
            'all',
            'red',
            'green',
            'no_coa',
            'expired',
            'amber',
            'audit_overdue',
            'audit_missing',
          ].map((f) => (
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

        <div className="mb-4 overflow-hidden rounded-3xl border border-sky-300 bg-white dark:!border-sky-400 dark:!bg-sky-950">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
            <p className="text-sm font-black">Break down this slice</p>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['district', 'District'],
                  ['province', 'Province'],
                  ['circuit', 'Circuit'],
                  ['coa', 'CoA'],
                  ['risk', 'Risk'],
                  ['audit', 'Month audit'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSliceGroup(id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    sliceGroup === id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Slice</th>
                  <th className="px-3 py-2">Schools</th>
                  <th className="px-3 py-2">Valid CoA %</th>
                  <th className="px-3 py-2">No CoA</th>
                  <th className="px-3 py-2">Red</th>
                  <th className="px-3 py-2">Audits done</th>
                  <th className="px-3 py-2">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {groupRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-slate-400"
                    >
                      No schools in this slice.
                    </td>
                  </tr>
                ) : (
                  groupRows.map((g) => (
                    <tr
                      key={g.key}
                      className="cursor-pointer border-b border-slate-100 hover:bg-sky-50/60"
                      onClick={() => {
                        if (sliceGroup === 'province') {
                          setProvince(g.key === 'Unknown' ? '' : g.key);
                          setDistrict('');
                          setCircuit('');
                        } else if (sliceGroup === 'district') {
                          setDistrict(g.key === 'Unknown' ? '' : g.key);
                          setCircuit('');
                        } else if (sliceGroup === 'circuit') {
                          setCircuit(g.key === 'Unknown' ? '' : g.key);
                        } else if (sliceGroup === 'coa') {
                          setCoa(g.key === 'none' ? 'none' : g.key);
                        } else if (sliceGroup === 'risk') {
                          setFilter(g.key === 'unknown' ? 'all' : g.key);
                        } else if (sliceGroup === 'audit') {
                          if (g.key === 'overdue') setFilter('audit_overdue');
                          else if (g.key === 'none') setFilter('audit_missing');
                          else setFilter('all');
                        }
                      }}
                    >
                      <td className="px-3 py-2 font-semibold capitalize">
                        {g.key.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2 tabular-nums font-bold">
                        {g.schools}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {g.valid_coa_pct}%
                      </td>
                      <td className="px-3 py-2 tabular-nums">{g.none_coa}</td>
                      <td className="px-3 py-2 tabular-nums font-bold text-rose-700">
                        {g.red}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {g.monthly_audit_done_pct}%
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {g.monthly_audit_overdue}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">School</th>
                <th className="px-3 py-2">District</th>
                <th className="px-3 py-2">Circuit</th>
                <th className="px-3 py-2">CoA</th>
                <th className="px-3 py-2">R638</th>
                <th className="px-3 py-2">This month audit</th>
                <th className="px-3 py-2">PIC</th>
                <th className="px-3 py-2">PEU</th>
                <th className="px-3 py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {slicedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-10 text-center text-slate-400"
                  >
                    No kitchens match this slice.
                  </td>
                </tr>
              ) : (
                slicedRows.map((r) => (
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
                    <td className="px-3 py-2 text-xs">
                      {String(r.district || '—')}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {String(r.circuit || '—')}
                    </td>
                    <td className="px-3 py-2 text-xs font-bold uppercase">
                      {String(r.coa_status)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.r638_score != null ? `${r.r638_score}%` : '—'}{' '}
                      <span className="uppercase opacity-70">
                        {String(r.r638_band || '')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="font-bold uppercase">
                        {String(r.monthly_audit_status || 'none')}
                      </span>
                      {r.monthly_audit_planned_date ? (
                        <div className="text-[10px] text-slate-400">
                          {String(r.monthly_audit_planned_date).slice(0, 10)}
                          {r.monthly_audit_score != null
                            ? ` · ${r.monthly_audit_score}%`
                            : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {String(r.pic_name || '—')}
                    </td>
                    <td className="px-3 py-2 text-xs capitalize">
                      {String(r.peu_verify_status || '—')}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${bandClass(r.risk_band as SafetyBand)}`}
                      >
                        {String(r.risk_band)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Click a slice row to drill in. Soft gate shows risk on claims; hard
          gate blocks submit.
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

      {/* Monthly audit calendar + checklist */}
      <div className="mb-6 space-y-4 rounded-3xl border border-violet-200 bg-white p-5 dark:border-violet-900 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black">
              Monthly R638 audit calendar
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Schedule the monthly kitchen audit on a calendar day, complete the
              checklist that day (or when done). Results sync to the DBE register
              and owner management pack.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {(
              [
                ['planned', 'Planned'],
                ['done', 'Done'],
                ['overdue', 'Overdue'],
              ] as const
            ).map(([k, l]) => (
              <span
                key={k}
                className={`rounded-full border px-2 py-0.5 font-bold ${
                  k === 'done'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : k === 'overdue'
                      ? 'border-rose-300 bg-rose-50 text-rose-900'
                      : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}
              >
                {l}:{' '}
                {k === 'done'
                  ? Number(monthlyStats?.done || 0)
                  : k === 'overdue'
                    ? Number(monthlyStats?.overdue || 0)
                    : Number(monthlyStats?.planned || 0)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="btn-secondary !py-1.5 !px-3 text-xs"
            onClick={() => shiftMonth(-1)}
          >
            ← Prev
          </button>
          <p className="text-sm font-black tabular-nums">
            {new Date(calYear, calMonth - 1, 1).toLocaleString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <button
            type="button"
            className="btn-secondary !py-1.5 !px-3 text-xs"
            onClick={() => shiftMonth(1)}
          >
            Next →
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[320px] grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-black uppercase text-slate-400 py-1"
              >
                {d}
              </div>
            ))}
            {calendarWeeks.flat().map((cell) => {
              const st = cell.audit?.status;
              const selected = cell.date === selectedDate;
              return (
                <button
                  key={cell.date + String(cell.inMonth)}
                  type="button"
                  onClick={() => selectCalendarDay(cell)}
                  className={`min-h-[3.25rem] rounded-xl border px-1 py-1 text-left transition-colors ${
                    selected
                      ? 'border-violet-600 ring-2 ring-violet-300'
                      : 'border-slate-100'
                  } ${
                    !cell.inMonth
                      ? 'bg-slate-50 opacity-50'
                      : st === 'done'
                        ? 'bg-emerald-50 border-emerald-200'
                        : st === 'overdue'
                          ? 'bg-rose-50 border-rose-200'
                          : st === 'planned'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-white hover:bg-violet-50'
                  }`}
                >
                  <div className="text-[11px] font-black tabular-nums">
                    {Number(cell.date.slice(8, 10))}
                  </div>
                  {cell.audit ? (
                    <div className="text-[9px] font-bold uppercase leading-tight mt-0.5">
                      {cell.audit.status}
                      {cell.audit.score != null
                        ? ` · ${cell.audit.score}%`
                        : ''}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-xs font-bold text-slate-700">
            Selected day:{' '}
            <span className="tabular-nums font-black">{selectedDate}</span>
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => void scheduleSelectedDay()}
            className="btn-secondary !py-1.5 !px-3 text-xs"
          >
            Schedule monthly audit on this day
          </button>
          {monthlyStats?.this_month_status ? (
            <span className="text-[11px] text-slate-500">
              This month: {String(monthlyStats.this_month_status)}
              {monthlyStats.this_month_planned_date
                ? ` · planned ${String(monthlyStats.this_month_planned_date)}`
                : ''}
            </span>
          ) : null}
        </div>

        <h4 className="text-sm font-black pt-1">
          Checklist for {selectedDate}
        </h4>
        <p className="text-[11px] text-slate-500 -mt-2">
          Complete and save — stored against this planned/completion day. Red
          scores open a compliance item and raise risk on the DBE kitchen
          register.
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
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Completed by (name)"
            value={auditByName}
            onChange={(e) => setAuditByName(e.target.value)}
          />
          <input
            type="date"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
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
          Save checklist on {selectedDate}
        </button>
        {monthlyAudits.filter((m) => m.status === 'done').length > 0 ? (
          <div className="text-[11px] text-slate-500">
            Recent completed:{' '}
            {monthlyAudits
              .filter((m) => m.status === 'done')
              .slice(0, 4)
              .map(
                (a) =>
                  `${String(a.completed_date || a.planned_date).slice(0, 10)} · ${a.score ?? '—'}% ${a.band || ''}`
              )
              .join(' · ')}
          </div>
        ) : audits.length > 0 ? (
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
