'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  ShieldCheck,
  Plus,
  Pencil,
  X,
  Save,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Learner = {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string | null;
  class_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  nsnp_eligible?: boolean;
  verification_status?: string;
  status?: string;
  external_id?: string | null;
  special_diet?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
};

type LearnerForm = {
  external_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  grade: string;
  class_name: string;
  gender: string;
  nsnp_eligible: boolean;
  special_diet: string;
  guardian_name: string;
  guardian_phone: string;
  verification_status: string;
};

const emptyForm = (): LearnerForm => ({
  external_id: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  grade: '',
  class_name: '',
  gender: '',
  nsnp_eligible: true,
  special_diet: '',
  guardian_name: '',
  guardian_phone: '',
  verification_status: 'draft',
});

function learnerToForm(l: Learner): LearnerForm {
  return {
    external_id: l.external_id || '',
    first_name: l.first_name || '',
    last_name: l.last_name || '',
    date_of_birth: l.date_of_birth
      ? String(l.date_of_birth).slice(0, 10)
      : '',
    grade: l.grade || '',
    class_name: l.class_name || '',
    gender: l.gender || '',
    nsnp_eligible: l.nsnp_eligible !== false,
    special_diet: l.special_diet || '',
    guardian_name: l.guardian_name || '',
    guardian_phone: l.guardian_phone || '',
    verification_status: l.verification_status || 'draft',
  };
}

export default function LearnersPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState({
    total: 0,
    verified: 0,
    eligible: 0,
  });

  // Add / edit panel
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LearnerForm>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
      });
      if (q) params.set('q', q);
      const res = await fetch(`/api/schools/learners?${params}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLearners(data.learners || []);
      if (data.counts) setCounts(data.counts);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadTemplateA = (format: 'xlsx' | 'csv' = 'xlsx') => {
    window.open(
      `/api/schools/learners?template=A&format=${format}&companyId=${companyId}`,
      '_blank'
    );
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = String(reader.result || '');
        const b64 = r.includes(',') ? r.split(',')[1] : r;
        resolve(b64);
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  const onFile = async (file: File) => {
    setImporting(true);
    try {
      const name = file.name.toLowerCase();
      const isXlsx =
        name.endsWith('.xlsx') ||
        name.endsWith('.xls') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel');

      let body: Record<string, unknown>;
      if (isXlsx) {
        const xlsxBase64 = await fileToBase64(file);
        body = {
          companyId,
          import: true,
          xlsxBase64,
          fileName: file.name,
        };
      } else {
        const text = await file.text();
        body = {
          companyId,
          import: true,
          csv: text,
          fileName: file.name,
        };
      }

      const res = await fetch('/api/schools/learners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      toast.success(
        `Imported ${data.imported} learners (draft — verify / attest next)`
      );
      if (data.parseErrors?.length) {
        toast.message(`${data.parseErrors.length} row warning(s)`);
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const verifySelected = async (status: string) => {
    if (!selected.size) {
      toast.error('Select learners first');
      return;
    }
    try {
      const res = await fetch('/api/schools/learners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ids: [...selected],
          verification_status: status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verify failed');
      toast.success(`Updated ${data.updated} learners → ${status}`);
      setSelected(new Set());
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (l: Learner) => {
    setEditId(l.id);
    setForm(learnerToForm(l));
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditId(null);
    setForm(emptyForm());
  };

  const setF = <K extends keyof LearnerForm>(key: K, value: LearnerForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveLearner = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('First name and last name are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        external_id: form.external_id.trim() || null,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        grade: form.grade.trim() || null,
        class_name: form.class_name.trim() || null,
        gender: form.gender.trim() || null,
        nsnp_eligible: form.nsnp_eligible,
        special_diet: form.special_diet.trim() || null,
        guardian_name: form.guardian_name.trim() || null,
        guardian_phone: form.guardian_phone.trim() || null,
        verification_status: form.verification_status || 'draft',
      };

      const res = await fetch('/api/schools/learners', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editId ? { ...payload, id: editId } : payload
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(editId ? 'Learner updated' : 'Learner added');
      closeForm();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const verified =
    counts.verified ||
    learners.filter((l) =>
      ['school_verified', 'attested'].includes(String(l.verification_status))
    ).length;
  const eligible =
    counts.eligible ||
    learners.filter((l) => l.nsnp_eligible !== false).length;

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Learners"
        titleAccent="Import & verify"
        description="Excel-compatible CSV import · school attestation verification · NSNP eligibility. Add one learner at a time or bulk-import Template A (.xlsx)."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openNew}
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add learner
            </button>
            <button
              type="button"
              onClick={() => downloadTemplateA('xlsx')}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
              title="Download Template A (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" /> Template A .xlsx
            </button>
            <button
              type="button"
              onClick={() => downloadTemplateA('csv')}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
              title="CSV fallback for Excel"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <label className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5 cursor-pointer">
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Import Template A
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void onFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* Add / Edit form */}
      {formOpen ? (
        <div className="mb-4 rounded-3xl border border-sky-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black flex items-center gap-2">
              {editId ? (
                <>
                  <Pencil className="w-4 h-4 text-sky-700" />
                  Edit learner #{editId}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-sky-700" />
                  Add one learner
                </>
              )}
            </p>
            <button
              type="button"
              onClick={closeForm}
              className="text-slate-400 hover:text-slate-700 p-1"
              aria-label="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="First name *">
              <input
                className={inputCls}
                value={form.first_name}
                onChange={(e) => setF('first_name', e.target.value)}
                placeholder="Thabo"
                autoFocus
              />
            </Field>
            <Field label="Last name *">
              <input
                className={inputCls}
                value={form.last_name}
                onChange={(e) => setF('last_name', e.target.value)}
                placeholder="Molefe"
              />
            </Field>
            <Field label="External / learner ID">
              <input
                className={inputCls}
                value={form.external_id}
                onChange={(e) => setF('external_id', e.target.value)}
                placeholder="L001"
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                className={inputCls}
                value={form.date_of_birth}
                onChange={(e) => setF('date_of_birth', e.target.value)}
              />
            </Field>
            <Field label="Grade">
              <input
                className={inputCls}
                value={form.grade}
                onChange={(e) => setF('grade', e.target.value)}
                placeholder="4"
              />
            </Field>
            <Field label="Class">
              <input
                className={inputCls}
                value={form.class_name}
                onChange={(e) => setF('class_name', e.target.value)}
                placeholder="4A"
              />
            </Field>
            <Field label="Gender">
              <select
                className={inputCls}
                value={form.gender}
                onChange={(e) => setF('gender', e.target.value)}
              >
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="NSNP eligible">
              <select
                className={`${inputCls} font-bold`}
                value={form.nsnp_eligible ? 'Y' : 'N'}
                onChange={(e) => setF('nsnp_eligible', e.target.value === 'Y')}
              >
                <option value="Y">Yes — eligible for meals</option>
                <option value="N">No — not NSNP eligible</option>
              </select>
            </Field>
            <Field label="Special diet">
              <input
                className={inputCls}
                value={form.special_diet}
                onChange={(e) => setF('special_diet', e.target.value)}
                placeholder="Halal, allergy…"
              />
            </Field>
            <Field label="Guardian name">
              <input
                className={inputCls}
                value={form.guardian_name}
                onChange={(e) => setF('guardian_name', e.target.value)}
              />
            </Field>
            <Field label="Guardian phone">
              <input
                className={inputCls}
                value={form.guardian_phone}
                onChange={(e) => setF('guardian_phone', e.target.value)}
                placeholder="082…"
              />
            </Field>
            <Field label="Verification status">
              <select
                className={inputCls}
                value={form.verification_status}
                onChange={(e) => setF('verification_status', e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="school_verified">School verified</option>
                <option value="attested">Attested</option>
                <option value="flagged">Flagged</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveLearner()}
              className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {editId ? 'Update learner' : 'Save learner'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / grade / class…"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-56"
        />
        <span className="text-xs text-slate-500">
          {learners.length} shown · {counts.total || learners.length} total ·{' '}
          {verified} verified · {eligible} NSNP eligible
        </span>
        <button
          type="button"
          onClick={() => void verifySelected('school_verified')}
          className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Mark school-verified
        </button>
        <button
          type="button"
          onClick={() => void verifySelected('attested')}
          className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark attested
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
        <strong className="text-slate-800">Template A workflow:</strong> download{' '}
        <button
          type="button"
          className="font-bold text-[#0077b6] hover:underline"
          onClick={() => downloadTemplateA('xlsx')}
        >
          NSNP_Learners_Template_A.xlsx
        </button>
        , fill one row per learner, import, then select rows and mark{' '}
        <em>school-verified</em> then <em>attested</em>. Or use{' '}
        <button
          type="button"
          className="font-bold text-[#0077b6] hover:underline"
          onClick={openNew}
        >
          Add learner
        </button>{' '}
        for a single capture.
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                  <th className="px-3 py-3 w-10" />
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Grade</th>
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">NSNP</th>
                  <th className="px-3 py-3">Verification</th>
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {learners.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-slate-500 space-y-3"
                    >
                      <p>No learners yet.</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={openNew}
                          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Add first learner
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadTemplateA('xlsx')}
                          className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" /> Template A .xlsx
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  learners.map((l) => (
                    <tr
                      key={l.id}
                      className={`border-b border-slate-50 hover:bg-sky-50/40 ${
                        editId === l.id ? 'bg-sky-50/70' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(l.id)}
                          onChange={() => toggle(l.id)}
                          aria-label={`Select ${l.first_name} ${l.last_name}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {l.first_name} {l.last_name}
                        {l.special_diet ? (
                          <span className="block text-[10px] font-normal text-amber-700">
                            {l.special_diet}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{l.grade || '—'}</td>
                      <td className="px-3 py-2">{l.class_name || '—'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            l.nsnp_eligible !== false
                              ? 'text-emerald-700 font-bold'
                              : 'text-slate-400'
                          }
                        >
                          {l.nsnp_eligible !== false ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            l.verification_status === 'attested'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : l.verification_status === 'school_verified'
                                ? 'bg-sky-50 border-sky-200 text-sky-800'
                                : l.verification_status === 'flagged'
                                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {l.verification_status || 'draft'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 font-mono">
                        {l.external_id || l.id}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(l)}
                          className="text-[11px] font-bold text-[#0077b6] px-2 py-1 hover:underline inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </SchoolsPage>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs block">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
