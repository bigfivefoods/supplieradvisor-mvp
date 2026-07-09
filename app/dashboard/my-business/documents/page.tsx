'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

type DocRow = {
  id?: number;
  name: string;
  url: string;
  category?: string;
  uploaded_at?: string;
};

/**
 * Company documents vault — persists JSON list on profiles.metadata.documents
 * (works without a dedicated table; upgrades cleanly later).
 */
export default function BusinessDocumentsPage() {
  return (
    <CompanyRequired>
      <DocsInner />
    </CompanyRequired>
  );
}

function DocsInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const supabase = createClient();

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', category: 'Other' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/profile?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const meta = data.profile?.metadata;
      const list =
        meta && typeof meta === 'object' && Array.isArray((meta as { documents?: unknown }).documents)
          ? ((meta as { documents: DocRow[] }).documents as DocRow[])
          : [];
      setDocs(list);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: DocRow[]) => {
    setSaving(true);
    try {
      // Load current metadata then merge
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/profile?${params}`);
      const data = await res.json();
      const prevMeta =
        data.profile?.metadata && typeof data.profile.metadata === 'object'
          ? { ...data.profile.metadata }
          : {};
      prevMeta.documents = next;

      const { error } = await supabase
        .from('profiles')
        .update({ metadata: prevMeta, updated_at: new Date().toISOString() })
        .eq('id', companyId);

      if (error) throw error;
      setDocs(next);
      toast.success('Documents synced to Supabase');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error('Name and URL required');
      return;
    }
    const row: DocRow = {
      id: Date.now(),
      name: form.name.trim(),
      url: form.url.trim(),
      category: form.category,
      uploaded_at: new Date().toISOString(),
    };
    await persist([row, ...docs]);
    setForm({ name: '', url: '', category: 'Other' });
  };

  const remove = async (id?: number) => {
    await persist(docs.filter((d) => d.id !== id));
  };

  return (
    <BusinessPage>
      <BusinessHeader
        title="Company"
        titleAccent="documents"
        description="Vault of policies, contracts, and certificates. Stored on the company profile metadata and readable by your team."
      />

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel title="Add document" className="lg:col-span-2">
          <div className="p-5 space-y-3">
            <input
              className="input w-full !p-3 !text-sm"
              placeholder="Document name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="input w-full !p-3 !text-sm"
              placeholder="File URL * (upload to storage, paste link)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
            <select
              className="input w-full !p-3 !text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {['Contracts', 'Policies', 'Financial', 'HR', 'Legal', 'Other'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary w-full !py-3 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add to vault'}
            </button>
          </div>
        </Panel>

        <Panel title="Vault" className="lg:col-span-3">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
            </div>
          ) : docs.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              No documents yet
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {docs.map((d) => (
                <li
                  key={d.id || d.url}
                  className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{d.name}</div>
                    <div className="text-xs text-neutral-500">
                      {d.category}
                      {d.uploaded_at
                        ? ` · ${new Date(d.uploaded_at).toLocaleDateString()}`
                        : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary !py-1.5 !px-3 text-xs"
                    >
                      <ExternalLink className="w-3 h-3" /> Open
                    </a>
                    <button
                      type="button"
                      onClick={() => void remove(d.id)}
                      className="text-xs text-red-600 px-2"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </BusinessPage>
  );
}
