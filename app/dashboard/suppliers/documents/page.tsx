'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Share2, EyeOff } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { DOC_TYPES } from '@/lib/suppliers/types';
import { CompanyRequired, SuppliersHeader } from '@/components/suppliers/SuppliersShell';

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
};

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
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
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
      const res = await fetch(`/api/suppliers/documents?companyId=${companyId}`);
      const data = await res.json();
      setDocs(data.documents || []);
      if (data.warning) toast.message(data.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <SuppliersHeader
        title="Supplier documents"
        description="Private vault for contracts, certificates, and SLAs. Share with connected suppliers — version bumps when content changes so both sides stay in sync."
        action={
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            <Plus className="w-4 h-4" /> Add document
          </button>
        }
      />

      {show && (
        <div className="bg-white border rounded-3xl p-5 mb-6 grid sm:grid-cols-2 gap-3">
          <input
            className="input !p-3 !text-sm sm:col-span-2"
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="input !p-3 !text-sm"
            value={form.doc_type}
            onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
          >
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            className="input !p-3 !text-sm"
            placeholder="srm_suppliers id (optional)"
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
          />
          <input
            className="input !p-3 !text-sm sm:col-span-2"
            placeholder="File URL (upload to storage, paste link)"
            value={form.file_url}
            onChange={(e) => setForm({ ...form, file_url: e.target.value })}
          />
          <textarea
            className="input !p-3 !text-sm sm:col-span-2 min-h-[70px]"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="btn-primary sm:col-span-2 !py-3"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save document'}
          </button>
        </div>
      )}

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : docs.length === 0 ? (
          <div className="p-16 text-center text-sm text-neutral-500">No documents yet.</div>
        ) : (
          <ul className="divide-y">
            {docs.map((d) => (
              <li
                key={d.id}
                className="px-5 py-4 flex flex-wrap gap-3 justify-between items-center text-sm"
              >
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-xs text-neutral-500">
                    {d.doc_type} · v{d.version || 1}
                    {d.visibility === 'shared' ? ' · shared' : ' · private'}
                    {d.file_url ? (
                      <>
                        {' · '}
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00b4d8] underline"
                        >
                          open
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  {d.visibility === 'shared' ? (
                    <button
                      type="button"
                      onClick={() => void setVisibility(d.id, 'unshare')}
                      className="btn-secondary !py-1.5 !px-3 text-xs"
                    >
                      <EyeOff className="w-3 h-3" /> Unshare
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void setVisibility(d.id, 'share')}
                      className="btn-primary !py-1.5 !px-3 text-xs"
                    >
                      <Share2 className="w-3 h-3" /> Share
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
