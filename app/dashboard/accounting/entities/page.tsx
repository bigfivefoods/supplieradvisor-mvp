'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  X,
  Star,
  Network,
  RefreshCw,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { statusClass, type AccountingEntity } from '@/lib/accounting/types';
import type { GroupCompanyForEntities } from '@/lib/accounting/entities-group';
import type { StructureTree } from '@/lib/business/group-structure';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import GroupStructureDiagram from '@/components/business/GroupStructureDiagram';
import GeoSelectFields, { type GeoValue } from '@/components/geo/GeoSelectFields';

export default function EntitiesPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [entities, setEntities] = useState<AccountingEntity[]>([]);
  const [groupCompanies, setGroupCompanies] = useState<
    GroupCompanyForEntities[]
  >([]);
  const [structure, setStructure] = useState<StructureTree[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    legal_name: '',
    country: 'ZA',
    currency: 'ZAR',
    tax_number: '',
    registration_number: '',
    is_primary: false,
    address: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/entities?${params}`);
      const data = await res.json();
      setEntities(data.entities || []);
      setGroupCompanies(data.groupCompanies || []);
      setStructure(Array.isArray(data.structure) ? data.structure : []);
      setUnsyncedCount(Number(data.unsyncedCount || 0));
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setEntities([]);
      setGroupCompanies([]);
      setStructure([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncGroup() {
    setSyncing(true);
    try {
      const res = await fetch('/api/accounting/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'sync_group',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      toast.success(data.message || 'Group companies synced');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Entity created');
      setShowModal(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function makePrimary(id: number) {
    try {
      const res = await fetch('/api/accounting/entities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, id, is_primary: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Primary entity updated');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const peers = groupCompanies.filter((g) => g.link_type !== 'self');

  return (
    <AccountingPage>
      <AccountingHeader
        title="Legal"
        titleAccent="entities"
        description="Legal entities for multi-entity books — including companies linked under Company → Group (holding, subsidiaries, associations)."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/my-business/group"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Network className="w-4 h-4" /> Company group
            </Link>
            <button
              type="button"
              onClick={() => void syncGroup()}
              disabled={syncing}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
              title="Create/update legal entities from active group links"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sync from group
              {unsyncedCount > 0 ? ` (${unsyncedCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add entity
            </button>
          </div>
        }
      />

      {/* Group tie-in banner */}
      <Panel className="mb-6 overflow-hidden border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0 flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-700">
              <Network className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Tied to Company → Group
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Holding companies, subsidiaries, and association members from your
                group structure can be legal entities in Finance. Use{' '}
                <strong>Sync from group</strong> after you accept links on the Group
                page.
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {peers.length === 0
                  ? 'No active group companies yet.'
                  : `${peers.length} group compan${peers.length === 1 ? 'y' : 'ies'} · ${unsyncedCount} not yet in the books`}
              </p>
            </div>
          </div>
          {unsyncedCount > 0 && (
            <button
              type="button"
              onClick={() => void syncGroup()}
              disabled={syncing}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {syncing ? 'Syncing…' : `Add ${unsyncedCount} to entities`}
            </button>
          )}
        </div>
      </Panel>

      {/* Structure diagram — same as Company → Group */}
      {!loading && (
        <div className="mb-6">
          <SectionLabel>Group structure</SectionLabel>
          <p className="mb-2 -mt-1 text-xs text-neutral-500">
            Full group chain (Holding → Sub → OpCo) with ownership % where set, plus
            associations and members. Managed on Company → Group; sync into books below.
          </p>
          <GroupStructureDiagram
            trees={structure}
            emptyHint="No active group structure. Link multi-level companies under Company → Group, then Sync from group."
          />
        </div>
      )}

      {/* Group companies (source of truth from Group page) */}
      {!loading && peers.length > 0 && (
        <div className="mb-6">
          <SectionLabel>Group companies</SectionLabel>
          <Panel className="overflow-hidden">
            <ul className="divide-y divide-neutral-100">
              {peers.map((g) => (
                <li
                  key={g.profile_id}
                  className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="font-bold text-slate-900">
                        {g.display_name}
                      </span>
                      <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                        {g.link_type_label}
                      </span>
                      <span className="text-[10px] font-medium text-neutral-500">
                        {g.role === 'parent'
                          ? 'You are parent / group head'
                          : 'You are member / subsidiary'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {[g.country, g.city, g.registration_number ? `Reg ${g.registration_number}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                      {g.ownership_pct != null ? ` · ${g.ownership_pct}%` : ''}
                      {g.depth != null && g.depth > 1
                        ? ` · ${g.depth} levels from you`
                        : g.depth === 1
                          ? ' · direct link'
                          : ''}
                      {' · '}#{g.profile_id}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {g.entity_id ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                        In books · {g.entity_code || 'entity'}
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                        Not in books yet
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <SectionLabel>Legal entities (books)</SectionLabel>
      <Panel className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : entities.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            <p>
              No entities yet. Seed the chart of accounts for a primary HQ entity,
              sync from Company → Group, or add one manually.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void syncGroup()}
                className="btn-secondary !py-2 !px-4 text-sm"
              >
                Sync from group
              </button>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="btn-primary !py-2 !px-4 text-sm"
              >
                Add entity
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {entities.map((e) => (
              <div
                key={e.id}
                className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{e.name}</span>
                    <span className="font-mono text-xs text-neutral-400">
                      {e.code}
                    </span>
                    {e.is_primary && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#00b4d8]/20 bg-[#00b4d8]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
                        <Star className="w-3 h-3" /> Primary
                      </span>
                    )}
                    {e.group_link_label && (
                      <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                        {e.group_link_label}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass(String(e.status || 'active'))}`}
                    >
                      {e.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {e.legal_name || e.name}
                    {e.country ? ` · ${e.country}` : ''}
                    {e.currency ? ` · ${e.currency}` : ''}
                    {e.tax_number ? ` · Tax ${e.tax_number}` : ''}
                    {e.registration_number
                      ? ` · Reg ${e.registration_number}`
                      : ''}
                    {e.linked_profile_id
                      ? ` · Group co #${e.linked_profile_id}`
                      : ''}
                  </div>
                  {e.address && (
                    <div className="mt-0.5 text-xs text-neutral-400">
                      {e.address}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {e.linked_profile_id ? (
                    <Link
                      href="/dashboard/my-business/group"
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      Group <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null}
                  {!e.is_primary && (
                    <button
                      type="button"
                      onClick={() => void makePrimary(e.id)}
                      className="btn-secondary !py-2 !px-4 text-xs"
                    >
                      Set primary
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="font-bold">New entity</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={create} className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Code
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="HQ"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Currency
                  <input
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-neutral-600">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Legal name
                <input
                  value={form.legal_name}
                  onChange={(e) =>
                    setForm({ ...form, legal_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <GeoSelectFields
                compact
                hideCity
                countryRequired={false}
                value={{
                  continent: '',
                  country: form.country || '',
                  province: '',
                  city: '',
                }}
                onChange={(g: GeoValue) =>
                  setForm((f) => ({ ...f, country: g.country }))
                }
              />
              <label className="block text-xs font-semibold text-neutral-600">
                Tax number
                <input
                  value={form.tax_number}
                  onChange={(e) =>
                    setForm({ ...form, tax_number: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Registration number
                <input
                  value={form.registration_number}
                  onChange={(e) =>
                    setForm({ ...form, registration_number: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(e) =>
                    setForm({ ...form, is_primary: e.target.checked })
                  }
                />
                Primary entity
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary !py-2 !px-4 text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary !py-2 !px-4 text-sm"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AccountingPage>
  );
}
