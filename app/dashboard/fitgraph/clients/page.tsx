'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fc,
} from '@/components/fitness/FitForm';
import { MEMBERSHIP_STATUSES } from '@/lib/fitness/fitgraph';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || '');
      const b64 = r.includes(',') ? r.split(',')[1] : r;
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function ClientsPage() {
  const { companyId, store, loading, saving, post, load, summary } =
    useFitgraph();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    membership_plan_id: '',
    membership_status: 'active',
    coach_id: '',
    start_date: new Date().toISOString().slice(0, 10),
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'clients',
      action: 'upsert',
      record: {
        ...form,
        membership_plan_id: form.membership_plan_id || null,
        coach_id: form.coach_id || null,
      },
    });
    toast.success('Client saved');
    setForm((f) => ({ ...f, code: '', name: '', email: '', phone: '' }));
  };

  const downloadXlsx = (kind: 'clients' | 'clients_template') => {
    const url = `/api/fitness/fitgraph?companyId=${companyId}&export=${kind}`;
    window.open(url, '_blank');
  };

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
          action: 'import_clients',
          xlsxBase64,
          fileName: file.name,
        };
      } else {
        const text = await file.text();
        body = {
          action: 'import_clients',
          csv: text,
          fileName: file.name,
        };
      }

      const data = await post(body);
      const created = Number(data?.created) || 0;
      const updated = Number(data?.updated) || 0;
      toast.success(
        data?.message ||
          `Imported ${created} new, updated ${updated} existing client(s)`
      );
      const warnings = (data?.warnings || []) as string[];
      const parseErrors = (data?.parseErrors || []) as string[];
      if (warnings.length) {
        toast.message(
          `${warnings.length} warning(s): ${warnings.slice(0, 3).join('; ')}${
            warnings.length > 3 ? '…' : ''
          }`
        );
      }
      if (parseErrors.length) {
        toast.message(
          `${parseErrors.length} row issue(s): ${parseErrors
            .slice(0, 3)
            .join('; ')}`
        );
      }
      await load();
    } catch (e: unknown) {
      // post() already toasts on failure
      if (!(e instanceof Error)) toast.error('Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <FitgraphWorkbench
      title="Clients / members"
      titleAccent="member book"
      description="Member register with plan, status and optional coach assignment. Download the client list as .xlsx, or upload a filled template to add / update members in bulk."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="member"
            items={[
              { label: 'Clients', value: Number(summary?.clientCount) || 0 },
              { label: 'Active', value: Number(summary?.activeMembers) || 0 },
            ]}
          />

          {/* Excel export / import */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-700/50 dark:bg-sky-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-sky-950 dark:text-sky-100">
                  Client list (.xlsx)
                </h3>
                <p className="text-[11px] text-sky-900/80 dark:text-sky-200/80 mt-0.5 max-w-xl">
                  Download your current members, or a blank template with Plans
                  and Coaches reference sheets. Fill rows and upload to create
                  or update clients (match by <strong>code</strong> or{' '}
                  <strong>email</strong>).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadXlsx('clients')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download list
                </button>
                <button
                  type="button"
                  onClick={() => downloadXlsx('clients_template')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
                >
                  <Download className="w-3.5 h-3.5" />
                  Blank template
                </button>
                <button
                  type="button"
                  disabled={importing || saving}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {importing ? 'Importing…' : 'Upload .xlsx'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
              </div>
            </div>
            <p className="text-[10px] text-sky-800/70 dark:text-sky-300/70 mt-2">
              Columns: code, name*, email, phone, membership_plan_code,
              membership_status, coach_code, start_date, end_date,
              emergency_contact, notes, active (Y/N). *name required.
            </p>
          </div>

          <FormCard
            tone="member"
            title="Add client / member"
            onSubmit={() => void add()}
            saving={saving}
          >
            <input
              className={fc()}
              placeholder="Code"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
            <select
              className={fc()}
              value={form.membership_plan_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  membership_plan_id: e.target.value,
                }))
              }
            >
              <option value="">Plan…</option>
              {store.membership_plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.membership_status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  membership_status: e.target.value,
                }))
              }
            >
              {MEMBERSHIP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.coach_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, coach_id: e.target.value }))
              }
            >
              <option value="">Coach (optional)…</option>
              {store.coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className={fc()}
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_date: e.target.value }))
              }
            />
          </FormCard>
          <DataTable
            tone="member"
            headers={['Code', 'Name', 'Plan', 'Status', 'Coach', 'Phone']}
            rows={store.clients.map((c) => {
              const plan = store.membership_plans.find(
                (p) => p.id === c.membership_plan_id
              );
              const coach = store.coaches.find((x) => x.id === c.coach_id);
              return {
                id: c.id,
                cells: [
                  c.code,
                  c.name,
                  plan?.code || '—',
                  c.membership_status || '—',
                  coach?.name || '—',
                  c.phone || '—',
                ],
              };
            })}
            onDelete={(id) =>
              void post({ entity: 'clients', action: 'delete', id })
            }
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
