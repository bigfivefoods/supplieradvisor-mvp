'use client';

/**
 * DBE: bulk-import provincial school registry.
 * Parse in browser → import in batches of 75 (avoids Vercel 504 timeout).
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
import {
  parseSchoolRegistryFile,
  REGISTRY_BATCH_SIZE,
  type SchoolRegistryRow,
  type RegistryParseResult,
} from '@/lib/schools/school-registry-import';

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
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    phase: string;
  } | null>(null);
  const [parsed, setParsed] = useState<RegistryParseResult | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  const readJson = async (res: Response) => {
    const text = await res.text();
    if (!text) {
      throw new Error(
        res.ok ? 'Empty response' : `Server error ${res.status} (empty)`
      );
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const snippet = text.replace(/\s+/g, ' ').slice(0, 200);
      throw new Error(
        res.status === 504
          ? 'Server timed out (504). Use batch import — re-parse the file and click Import again.'
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

  const preview = async () => {
    if (!file) {
      toast.error('Choose an .xlsx or .csv file first');
      return;
    }
    setBusy(true);
    setResult(null);
    setProgress({ done: 0, total: 1, phase: 'Parsing in browser…' });
    try {
      const result = await parseSchoolRegistryFile(file, {
        provinceDefault: province,
      });
      setParsed(result);
      setProgress(null);
      if (!result.rows.length) {
        toast.error(
          result.errors[0]?.message ||
            'No school rows found — check header names'
        );
        return;
      }
      toast.success(
        `Parsed ${result.rows.length} schools from “${result.sheetName}”`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Parse failed');
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const importAll = async () => {
    let rows = parsed?.rows;
    if (!rows?.length) {
      if (!file) {
        toast.error('Preview the file first, or choose a file');
        return;
      }
      setBusy(true);
      try {
        const result = await parseSchoolRegistryFile(file, {
          provinceDefault: province,
        });
        setParsed(result);
        rows = result.rows;
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Parse failed');
        setBusy(false);
        return;
      }
    }
    if (!rows.length) {
      toast.error('No rows to import');
      setBusy(false);
      return;
    }

    if (
      !confirm(
        `Import ${rows.length} schools in batches of ${REGISTRY_BATCH_SIZE}? This may take a few minutes — keep this tab open.`
      )
    ) {
      setBusy(false);
      return;
    }

    setBusy(true);
    setResult(null);
    const batchSize = REGISTRY_BATCH_SIZE;
    const totalBatches = Math.ceil(rows.length / batchSize);
    let inserted = 0;
    let updated = 0;
    let linked = 0;
    let workspaces = 0;
    const allErrors: Array<{ row: string; message: string }> = [];

    try {
      for (let b = 0; b < totalBatches; b += 1) {
        const slice = rows.slice(b * batchSize, (b + 1) * batchSize);
        setProgress({
          done: b,
          total: totalBatches,
          phase: `Importing batch ${b + 1} of ${totalBatches} (${slice.length} schools)…`,
        });

        const res = await fetch('/api/schools/registry-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            action: 'import_batch',
            rows: slice,
            province,
            link_status: linkStatus,
            create_workspaces: createWorkspaces,
          }),
        });
        const data = await readJson(res);
        if (!res.ok) {
          throw new Error(
            String(data.error || `Batch ${b + 1} failed (${res.status})`)
          );
        }
        inserted += Number(data.inserted || 0);
        updated += Number(data.updated || 0);
        linked += Number(data.linked || 0);
        workspaces += Number(data.workspaces_created || 0);
        if (Array.isArray(data.errors)) {
          allErrors.push(
            ...(data.errors as Array<{ row: string; message: string }>)
          );
        }
      }

      setProgress({
        done: totalBatches,
        total: totalBatches,
        phase: 'Done',
      });
      const summary = {
        success: true,
        inserted,
        updated,
        linked,
        workspaces_created: workspaces,
        rowCount: rows.length,
        upsertErrorCount: allErrors.length,
        upsertErrors: allErrors.slice(0, 40),
        message: `Imported ${inserted + updated} schools (${inserted} new, ${updated} updated), linked ${linked} to your department.`,
      };
      setResult(summary);
      toast.success(summary.message);
      void loadStats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
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

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School registry import"
        titleAccent="xlsx / csv · batched"
        description="Parses in your browser, then uploads in small batches so large lists (5,000+ schools) do not hit server timeouts."
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

      <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <strong>How it works:</strong> 1) Choose file → Preview (parses locally).
        2) Import runs in batches of {REGISTRY_BATCH_SIZE} — keep this tab open.
        Avoids Vercel 504 timeouts on large files.
      </div>

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
          <p className="text-[11px] text-slate-500">
            Linked to you: {String(stats?.schools_linked_to_you ?? '—')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
            Expected columns
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            District · CMC · Circuit · Institution Name · Quintile · Local
            Municipality · Ward · Level · NATEMIS · NSNP Applic. Enrol. · Final
            EMIS Enrol · Final NSNP Approved Enrol.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 space-y-4">
        <h3 className="text-sm font-black flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-violet-700" />
          Upload school list
        </h3>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Province (default)
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
              Link as
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
          Create company workspace per school (much slower — leave off for bulk
          registry)
        </label>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            File (.xlsx or .csv)
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="block w-full text-sm"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setParsed(null);
              setResult(null);
              setProgress(null);
            }}
          />
          {file ? (
            <p className="text-xs text-slate-500 mt-1">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          ) : null}
        </label>

        {progress ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              {progress.phase}
            </p>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-[#00b4d8] transition-all"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
              {progress.done} / {progress.total} batches ({pct}%)
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void preview()}
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {busy && !progress?.phase.includes('Importing') ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            1. Preview (parse locally)
          </button>
          <button
            type="button"
            disabled={busy || (!file && !parsed)}
            onClick={() => void importAll()}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {busy && progress?.phase.includes('Importing') ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            2. Import in batches
          </button>
        </div>
      </div>

      {parsed ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Preview ready
          </h3>
          <p className="text-sm text-slate-600 mb-3">
            Sheet <strong>{parsed.sheetName}</strong> ·{' '}
            <strong>{parsed.rows.length}</strong> schools ·{' '}
            {parsed.errors.length} parse issues · will use{' '}
            {Math.ceil(parsed.rows.length / REGISTRY_BATCH_SIZE)} batches
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
                {parsed.rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1.5 pr-2 font-semibold">
                      {r.school_name}
                    </td>
                    <td className="py-1.5 pr-2">{r.district || '—'}</td>
                    <td className="py-1.5 pr-2">{r.cmc || '—'}</td>
                    <td className="py-1.5 pr-2">{r.circuit || '—'}</td>
                    <td className="py-1.5 pr-2 font-mono">
                      {r.natemis || '—'}
                    </td>
                    <td className="py-1.5 pr-2">{r.quintile ?? '—'}</td>
                    <td className="py-1.5">
                      {r.final_nsnp_approved_enrol ?? '—'}
                    </td>
                  </tr>
                ))}
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
                Row errors: {String(result.upsertErrorCount)}
              </li>
            ) : null}
          </ul>
          <Link
            href="/dashboard/schools/join"
            className="inline-block mt-3 text-xs font-bold text-[#0077b6] underline"
          >
            Review on Join &amp; add →
          </Link>
        </div>
      ) : null}
    </SchoolsPage>
  );
}
