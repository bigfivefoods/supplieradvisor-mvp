'use client';

/**
 * DBE: bulk-import provincial school registry (xlsx / csv) — 5000+ schools.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import { useProgrammeRole } from '@/lib/schools/useProgrammeRole';
import { SA_PROVINCES } from '@/lib/schools/types';

export default function RegistryImportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const programme = useProgrammeRole();
  const [province, setProvince] = useState('KwaZulu-Natal');
  const [linkStatus, setLinkStatus] = useState<'active' | 'pending'>('active');
  const [createWorkspaces, setCreateWorkspaces] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  const readJson = async (res: Response) => {
    const text = await res.text();
    if (!text) {
      throw new Error(
        res.ok
          ? 'Empty response from server'
          : `Server error ${res.status} (empty body)`
      );
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Server returned HTML/plain text e.g. "An error occurred"
      const snippet = text.replace(/\s+/g, ' ').slice(0, 180);
      throw new Error(
        res.ok
          ? `Invalid server response: ${snippet}`
          : `Server error ${res.status}: ${snippet}`
      );
    }
  };

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/schools/registry-import?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await readJson(res);
      if (res.ok) setStats(data);
    } catch {
      /* soft */
    }
  }, [companyId]);

  useEffect(() => {
    if (programme.role === 'department') void loadStats();
  }, [programme.role, loadStats]);

  const upload = async (dryRun: boolean) => {
    if (!file) {
      toast.error('Choose an .xlsx or .csv file first');
      return;
    }
    setBusy(true);
    if (!dryRun) setResult(null);
    try {
      const fd = new FormData();
      fd.set('companyId', String(companyId));
      fd.set('province', province);
      fd.set('link_status', linkStatus);
      fd.set('dryRun', dryRun ? '1' : '0');
      fd.set('create_workspaces', createWorkspaces ? '1' : '0');
      fd.set('file', file);
      const res = await fetch('/api/schools/registry-import', {
        method: 'POST',
        body: fd,
      });
      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(String(data.error || `Import failed (${res.status})`));
      }
      if (dryRun) {
        setPreview(data);
        toast.success(
          `Preview: ${data.rowCount} schools parsed from “${data.sheetName}”`
        );
      } else {
        setResult(data);
        toast.success(String(data.message || 'Import complete'));
        void loadStats();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (programme.loading) {
    return (
      <SchoolsPage>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </SchoolsPage>
    );
  }

  if (programme.role !== 'department') {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="School registry import"
          titleAccent="DBE only"
          description="Only the department can bulk-import the provincial school list."
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="font-bold">Switch to your DBE / DoH company</p>
          <Link
            href="/dashboard/schools/join"
            className="btn-primary !py-2 !px-4 text-sm mt-4 inline-flex"
          >
            Join &amp; add
          </Link>
        </div>
      </SchoolsPage>
    );
  }

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School registry import"
        titleAccent="xlsx / csv"
        description="Import all provincial schools (district, CMC, circuit, NATEMIS, quintile, municipality, NSNP enrolment). Upserts by NATEMIS and links them to your department."
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/schools/join"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Join &amp; add
            </Link>
            <button
              type="button"
              onClick={() => void loadStats()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">
            Schools in system
          </p>
          <p className="text-2xl font-black tabular-nums">
            {stats?.schools_in_system != null
              ? String(stats.schools_in_system)
              : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
            Expected columns
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {(stats?.expected_columns as string[] | undefined)?.join(' · ') ||
              'District · CMC · Circuit · Institution Name · Quintile · Local Municipality · Municipality Ward Number · Level · NATEMIS · NSNP Applic. Enrol. 26-27 · Final EMIS Enrol:2026 · Final NSNP Approved Enrol. 26-27'}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 space-y-4">
        <h3 className="text-sm font-black flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-violet-700" />
          Upload school list
        </h3>
        <p className="text-xs text-slate-600">
          Supports <strong>.xlsx</strong> and <strong>.csv</strong> (open Excel
          and Save As CSV if needed). First sheet is used. Header row is
          detected automatically.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Province (default for rows)
            </span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              {SA_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Link to your department as
            </span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              value={linkStatus}
              onChange={(e) =>
                setLinkStatus(e.target.value as 'active' | 'pending')
              }
            >
              <option value="active">Approved (active)</option>
              <option value="pending">Pending approval</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={createWorkspaces}
            onChange={(e) => setCreateWorkspaces(e.target.checked)}
          />
          Also create a company workspace per school (slower; only if each
          school will log in soon)
        </label>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            File
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="block w-full text-sm"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
              setResult(null);
            }}
          />
          {file ? (
            <p className="text-xs text-slate-500 mt-1">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          ) : null}
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void upload(true)}
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Preview (dry run)
          </button>
          <button
            type="button"
            disabled={busy || !file}
            onClick={() => {
              if (
                !confirm(
                  `Import all schools from ${file?.name}? Existing NATEMIS/EMIS rows will be updated.`
                )
              )
                return;
              void upload(false);
            }}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Import into system
          </button>
        </div>
      </div>

      {preview ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Preview
          </h3>
          <p className="text-sm text-slate-600 mb-3">
            Sheet <strong>{String(preview.sheetName)}</strong> ·{' '}
            <strong>{String(preview.rowCount)}</strong> schools ·{' '}
            {Number(preview.parseErrorCount || 0)} parse issues
          </p>
          <p className="text-[11px] text-slate-500 mb-2">
            Headers: {(preview.headers as string[] | undefined)?.join(' · ')}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                  <th className="py-2 pr-2">School</th>
                  <th className="py-2 pr-2">District</th>
                  <th className="py-2 pr-2">CMC</th>
                  <th className="py-2 pr-2">Circuit</th>
                  <th className="py-2 pr-2">NATEMIS</th>
                  <th className="py-2 pr-2">Q</th>
                  <th className="py-2">NSNP enrol</th>
                </tr>
              </thead>
              <tbody>
                {((preview.sample as Array<Record<string, unknown>>) || []).map(
                  (r, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-1.5 pr-2 font-semibold">
                        {String(r.school_name)}
                      </td>
                      <td className="py-1.5 pr-2">{String(r.district || '—')}</td>
                      <td className="py-1.5 pr-2">{String(r.cmc || '—')}</td>
                      <td className="py-1.5 pr-2">{String(r.circuit || '—')}</td>
                      <td className="py-1.5 pr-2 font-mono">
                        {String(r.natemis || '—')}
                      </td>
                      <td className="py-1.5 pr-2">{String(r.quintile ?? '—')}</td>
                      <td className="py-1.5">
                        {String(r.final_nsnp_approved_enrol ?? '—')}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5">
          <h3 className="text-sm font-black mb-2 flex items-center gap-2 text-emerald-900">
            <CheckCircle2 className="w-4 h-4" />
            Import result
          </h3>
          <p className="text-sm text-slate-800 mb-2">
            {String(result.message)}
          </p>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>New: {String(result.inserted)}</li>
            <li>Updated: {String(result.updated)}</li>
            <li>Linked to department: {String(result.linked)}</li>
            <li>Workspaces created: {String(result.workspaces_created)}</li>
            {Number(result.upsertErrorCount || 0) > 0 ? (
              <li className="text-rose-700 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                Errors: {String(result.upsertErrorCount)} (see first 40 in
                response)
              </li>
            ) : null}
          </ul>
          <Link
            href="/dashboard/schools/join"
            className="inline-block mt-3 text-xs font-bold text-[#0077b6] underline"
          >
            Review schools on Join &amp; add →
          </Link>
        </div>
      ) : null}
    </SchoolsPage>
  );
}
