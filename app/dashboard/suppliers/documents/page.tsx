'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { DOC_TYPES } from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';
import {
  SrmBoard,
  SrmEmpty,
  SrmSearch,
  SrmSelect,
  SrmSkeleton,
  SrmTimeline,
  SrmToolbar,
  SrmViewSwitch,
  srmFocus,
} from '@/components/suppliers/srm/SrmDesk';
import {
  compareText,
  matchesQuery,
  timelineFromStamps,
  type SrmView,
} from '@/lib/suppliers/srm-desk';

type Doc = {
  id: number;
  title: string;
  doc_type?: string;
  description?: string | null;
  file_url?: string | null;
  visibility?: string;
  shared_at?: string | null;
  version?: number;
  supplier_id?: number | null;
  updated_at?: string;
  created_at?: string;
};

type BookSupplier = { id: number; trading_name: string };

export default function SupplierDocumentsPage() {
  return (
    <CompanyRequired>
      <DocsInner />
    </CompanyRequired>
  );
}

function DocsInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [suppliers, setSuppliers] = useState<BookSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [docType, setDocType] = useState('all');
  const [view, setView] = useState<SrmView>('list');
  const [form, setForm] = useState({
    title: '',
    doc_type: 'contract',
    description: '',
    file_url: '',
    supplier_id: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, bookRes] = await Promise.all([
        fetch(`/api/suppliers/documents?companyId=${companyId}`),
        fetch(`/api/suppliers?companyId=${companyId}`),
      ]);
      const data = await docRes.json();
      setDocs(data.documents || []);
      if (data.warning) toast.message(data.warning);
      const book = await bookRes.json();
      setSuppliers(
        ((book.suppliers || []) as BookSupplier[]).filter((s) => s.id && s.trading_name)
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    return docs
      .filter((d) => (docType === 'all' ? true : d.doc_type === docType))
      .filter((d) =>
        matchesQuery(q, [d.title, d.doc_type, d.description, d.visibility])
      )
      .sort((a, b) => compareText(a.title || '', b.title || '', 'asc'));
  }, [docs, docType, q]);

  const create = async () => {
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/suppliers/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId: user?.id,
          title: form.title,
          doc_type: form.doc_type,
          description: form.description,
          file_url: form.file_url || null,
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Document added');
      setShow(false);
      setForm({ title: '', doc_type: 'contract', description: '', file_url: '', supplier_id: '' });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const setVisibility = async (id: number, action: 'share' | 'unshare') => {
    try {
      const res = await fetch('/api/suppliers/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId: user?.id,
          id,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(action === 'share' ? 'Shared with connected supplier' : 'Unshared');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <SuppliersPage>
    <div className="pb-8">
      <SuppliersHeader
        title="Supplier documents"
        description="Private vault for contracts, certificates, and SLAs. Share with connected suppliers — version bumps when content changes so both sides stay in sync."
        action={
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className={`${srmFocus} btn-primary !py-2.5 !px-5 text-sm`}
            aria-expanded={show}
          >
            <Plus className="w-4 h-4" /> {show ? 'Close form' : 'Add document'}
          </button>
        }
      />

      {show && (
        <form
          className="srm-rise mb-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
            Title
            <input
              className={`${srmFocus} input mt-1 !p-3 !text-sm`}
              placeholder="Supply agreement 2026"
              value={form.title}
              required
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Type
            <select
              className={`${srmFocus} input mt-1 !p-3 !text-sm`}
              value={form.doc_type}
              onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Supplier
            <select
              className={`${srmFocus} input mt-1 !p-3 !text-sm`}
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">Not linked</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.trading_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
            File URL
            <input
              className={`${srmFocus} input mt-1 !p-3 !text-sm`}
              placeholder="https://"
              inputMode="url"
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
            Description
            <textarea
              className={`${srmFocus} input mt-1 min-h-[70px] !p-3 !text-sm`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className={`${srmFocus} btn-primary sm:col-span-2 !py-3`}
          >
            {saving ? 'Saving…' : 'Save document'}
          </button>
        </form>
      )}

      <SrmToolbar meta={loading ? 'Loading the vault…' : `${visible.length} document${visible.length === 1 ? '' : 's'}`}>
        <SrmSearch value={q} onChange={setQ} label="Search documents" placeholder="Search title or description" />
        <SrmSelect
          label="Document type"
          value={docType}
          onChange={setDocType}
          options={[{ value: 'all', label: 'All types' }, ...DOC_TYPES.map((d) => ({ value: d.value, label: d.label }))]}
        />
        <SrmViewSwitch value={view} onChange={setView} />
      </SrmToolbar>

      {loading ? (
        <SrmSkeleton rows={4} variant={view === 'table' ? 'table' : 'list'} />
      ) : visible.length === 0 ? (
        <SrmEmpty
          title="No documents in this view"
          description="Add a contract, certificate, or SLA. Share it once the supplier is connected."
          actionLabel="Add document"
          onAction={() => setShow(true)}
        />
      ) : view === 'board' ? (
        <SrmBoard
          columns={DOC_TYPES.map((d) => ({ id: d.value, label: d.label }))}
          items={visible}
          columnOf={(d) => d.doc_type || 'other'}
          renderItem={(d) => <DocCard key={d.id} doc={d} onVisibility={setVisibility} />}
        />
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{d.title}</td>
                  <td className="px-4 py-3 text-slate-600">{d.doc_type}</td>
                  <td className="px-4 py-3 tabular-nums">v{d.version || 1}</td>
                  <td className="px-4 py-3">{d.visibility === 'shared' ? 'Shared' : 'Private'}</td>
                  <td className="px-4 py-3">
                    <ShareButton doc={d} onVisibility={setVisibility} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {visible.map((d) => (
            <li key={d.id} className="px-5 py-4">
              <DocCard doc={d} onVisibility={setVisibility} detailed />
            </li>
          ))}
        </ul>
      )}
    </div>
    </SuppliersPage>
  );
}

function ShareButton({
  doc,
  onVisibility,
}: {
  doc: Doc;
  onVisibility: (id: number, action: 'share' | 'unshare') => void;
}) {
  const shared = doc.visibility === 'shared';
  return (
    <button
      type="button"
      onClick={() => void onVisibility(doc.id, shared ? 'unshare' : 'share')}
      className={`${srmFocus} ${shared ? 'btn-secondary' : 'btn-primary'} !px-3 !py-1.5 text-xs`}
    >
      {shared ? 'Unshare' : 'Share'}
    </button>
  );
}

function DocCard({
  doc,
  onVisibility,
  detailed = false,
}: {
  doc: Doc;
  onVisibility: (id: number, action: 'share' | 'unshare') => void;
  detailed?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{doc.title}</div>
          <div className="text-xs text-slate-600">
            {doc.doc_type} · v{doc.version || 1}
            {doc.visibility === 'shared' ? ' · shared' : ' · private'}
            {doc.file_url ? (
              <>
                {' · '}
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${srmFocus} font-semibold text-[#0077b6] underline`}
                >
                  Open file
                </a>
              </>
            ) : null}
          </div>
        </div>
        <ShareButton doc={doc} onVisibility={onVisibility} />
      </div>
      {detailed ? (
        <div className="mt-3">
          <SrmTimeline
            events={timelineFromStamps([
              { id: 'created', title: 'Added to the vault', at: doc.created_at },
              { id: 'shared', title: 'Shared with the supplier', at: doc.shared_at },
              { id: 'updated', title: 'Updated', at: doc.updated_at },
            ])}
            empty="No dates stored on this document yet."
          />
        </div>
      ) : null}
    </div>
  );
}
