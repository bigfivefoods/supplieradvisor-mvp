'use client';

/**
 * DBE: bulk-import provincial service provider list.
 * Columns: District · Cluster Allocation · Name of Service Provider · CSD Number
 * Parse in browser → batches of 25 (avoids Vercel 504).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Truck,
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
  parseSpRegistryFile,
  SP_REGISTRY_BATCH_SIZE,
  type SpRegistryRow,
  type SpRegistryParseResult,
} from '@/lib/schools/sp-registry-import';

export default function SpRegistryImportPage() {
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
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    phase: string;
  } | null>(null);
  const [parsed, setParsed] = useState<SpRegistryParseResult | null>(null);
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
          ? 'Server timed out (504). Re-import in batches with the tab open.'
          : `Server error ${res.status}: ${snippet}`
      );
    }
  };

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/schools/sp-registry-import?companyId=${companyId}`,
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
      const result = await parseSpRegistryFile(file, {
        provinceDefault: province,
      });
      setParsed(result);
      setProgress(null);
      if (!result.rows.length) {
        toast.error(
          result.errors[0]?.message ||
            'No SP rows found — check header names'
        );
        return;
      }
      toast.success(
        `Parsed ${result.rows.length} service providers from “${result.sheetName}”`
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
        const result = await parseSpRegistryFile(file, {
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
        `Import ${rows.length} service providers in batches of ${SP_REGISTRY_BATCH_SIZE}? Keep this tab open.`
      )
    ) {
      setBusy(false);
      return;
    }

    setBusy(true);
    setResult(null);
    const batchSize = SP_REGISTRY_BATCH_SIZE;
    const totalBatches = Math.ceil(rows.length / batchSize);
    let inserted = 0;
    let updated = 0;
    let linked = 0;
    const allErrors: Array<{ row: string; message: string }> = [];

    try {
      for (let b = 0; b < totalBatches; b += 1) {
        const slice = rows.slice(b * batchSize, (b + 1) * batchSize);
        setProgress({
          done: b,
          total: totalBatches,
          phase: `Importing batch ${b + 1} of ${totalBatches} (${slice.length} SPs)…`,
        });

        const res = await fetch('/api/schools/sp-registry-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            action: 'import_batch',
            rows: slice,
            province,
            link_status: linkStatus,
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
        if (Array.isArray(data.errors)) {
          allErrors.push(
            ...(data.errors as Array<{ row: string; message: string }>)
          );
        }
      }

      setProgress({ done: totalBatches, total: totalBatches, phase: 'Done' });
      const summary = {
        success: true,
        inserted,
        updated,
        linked,
        rowCount: rows.length,
        upsertErrorCount: allErrors.length,
        upsertErrors: allErrors.slice(0, 40),
        message: `Imported ${inserted + updated} SPs (${inserted} new, ${updated} updated), linked ${linked} to your department.`,
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
          title="Import service providers"
          titleAccent="DBE only"
          description="Only the department can bulk-import the provincial SP list."
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="font-bold">Switch to your DBE / PEU company</p>
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
        title="Import service providers"
        titleAccent="xlsx / csv · batched"
        description="Provincial SP list: district, cluster allocation, name, CSD number. Parsed in your browser and linked to DBE."
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/schools/join"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Join &amp; add
            </Link>
            <Link
              href="/dashboard/schools/agency-report?report=isps"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              SP reports
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

      <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>How it works:</strong> 1) Choose file → Preview (parses
        locally). 2) Import in batches of {SP_REGISTRY_BATCH_SIZE} — keep this
        tab open. Upserts by <strong>CSD number</strong>; SPs are linked to
        your department as approved when “Active” is selected.
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">
            SPs in system
          </p>
          <p className="text-2xl font-black tabular-nums">
            {stats?.sps_in_system != null ? String(stats.sps_in_system) : '—'}
          </p>
          <p className="text-[11px] text-slate-500">
            Linked to you: {String(stats?.sps_linked_to_you ?? '—')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">
            From registry import
          </p>
          <p className="text-2xl font-black tabular-nums">
            {stats?.sps_from_registry != null
              ? String(stats.sps_from_registry)
              : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
            Expected columns
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            District · Cluster Allocation · Name of Service Provider · CSD
            Number
          </p>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6 space-y-4">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Truck className="w-4 h-4 text-amber-700" />
          Upload SP list
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
              Link status after import
            </span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              value={linkStatus}
              onChange={(e) =>
                setLinkStatus(e.target.value as 'active' | 'pending')
              }
            >
              <option value="active">Active (DBE-approved on books)</option>
              <option value="pending">Pending (approve later)</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            File (.xlsx or .csv)
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="block w-full text-sm"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setParsed(null);
              setResult(null);
            }}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void preview()}
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {busy && progress?.phase?.includes('Pars') ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Preview
          </button>
          <button
            type="button"
            disabled={busy || (!parsed?.rows.length && !file)}
            onClick={() => void importAll()}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {busy && progress && !progress.phase.includes('Pars') ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UploadIcon />
            )}
            Import in batches
          </button>
        </div>

        {progress ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-700">
              {progress.phase}
            </p>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {parsed && parsed.rows.length > 0 ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold">
                Preview · {parsed.rows.length.toLocaleString('en-ZA')} SPs
              </p>
              <p className="text-[11px] text-slate-500">
                Sheet “{parsed.sheetName}” ·{' '}
                {Math.ceil(parsed.rows.length / SP_REGISTRY_BATCH_SIZE)} batches
                {parsed.errors.length
                  ? ` · ${parsed.errors.length} parse warnings`
                  : ''}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase text-slate-400 sticky top-0">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-3 py-2">District</th>
                  <th className="px-3 py-2">Cluster</th>
                  <th className="px-3 py-2">CSD</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 40).map((r: SpRegistryRow, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.district || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.cluster_allocation || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.csd_number || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 40 ? (
            <p className="px-4 py-2 text-[11px] text-slate-500 border-t">
              Showing first 40 of {parsed.rows.length}…
            </p>
          ) : null}
          {parsed.errors.length > 0 ? (
            <div className="px-4 py-3 border-t bg-amber-50/50 text-xs text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              {parsed.errors.length} parse notes (e.g. duplicates). First:{' '}
              {parsed.errors[0]?.message}
            </div>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-bold text-emerald-950 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {String(result.message || 'Import complete')}
          </p>
          <p className="text-sm text-emerald-900 mt-1">
            New {String(result.inserted ?? 0)} · Updated{' '}
            {String(result.updated ?? 0)} · Linked {String(result.linked ?? 0)}
            {result.upsertErrorCount
              ? ` · ${String(result.upsertErrorCount)} row errors`
              : ''}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/dashboard/schools/join"
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              Manage on Join hub
            </Link>
            <Link
              href="/dashboard/schools/agency-report?report=isps"
              className="btn-primary !py-1.5 !px-3 text-xs"
            >
              View SP report →
            </Link>
          </div>
        </div>
      ) : null}
    </SchoolsPage>
  );
}

function UploadIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}
