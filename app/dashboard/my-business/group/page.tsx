'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  GitBranch,
  Landmark,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Search,
  Check,
  X,
  LogOut,
  Ban,
  Users,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import {
  GROUP_LINK_TYPES,
  type CompanyGroupLink,
  type GroupLinkType,
  type GroupPeerProfile,
  displayCompanyName,
  linkTypeMeta,
  statusBadgeClass,
  MIGRATION_HINT,
} from '@/lib/business/company-groups';

type Summary = {
  total: number;
  pending: number;
  active: number;
  as_parent: number;
  as_child: number;
  holdings: number;
  associations: number;
};

type SearchHit = GroupPeerProfile & { display_name?: string };

export default function CompanyGroupPage() {
  return (
    <CompanyRequired>
      <GroupInner />
    </CompanyRequired>
  );
}

function GroupInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [links, setLinks] = useState<CompanyGroupLink[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [parentDisplay, setParentDisplay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  // Composer
  const [showForm, setShowForm] = useState(false);
  const [linkType, setLinkType] = useState<GroupLinkType>('holding');
  const [asRole, setAsRole] = useState<'child' | 'parent'>('child');
  const [ownershipPct, setOwnershipPct] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<SearchHit | null>(null);
  const [peerIdManual, setPeerIdManual] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        status: statusFilter,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/group-links?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setLinks(data.links || []);
      setSummary(data.summary || null);
      setParentDisplay(data.parent_display_name || null);
      setWarning(data.warning || null);
      setHint(data.hint || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load group links');
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced company search
  useEffect(() => {
    if (!showForm || searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          companyId: String(companyId),
          mode: 'search',
          q: searchQ.trim(),
        });
        const res = await fetch(`/api/business/group-links?${params}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!cancelled) setSearchHits(data.companies || []);
      } catch {
        if (!cancelled) setSearchHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQ, showForm, companyId]);

  const meta = linkTypeMeta(linkType);

  const byBucket = useMemo(() => {
    const holdings = links.filter((l) => l.link_type === 'holding');
    const associations = links.filter((l) => l.link_type === 'association');
    const other = links.filter(
      (l) => l.link_type !== 'holding' && l.link_type !== 'association'
    );
    const pendingIn = links.filter((l) => {
      if (l.status !== 'pending') return false;
      // Awaiting our action as counterparty
      if (l.direction === 'invite') return l.role === 'child';
      return l.role === 'parent';
    });
    return { holdings, associations, other, pendingIn };
  }, [links]);

  const act = async (id: number, action: string) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/business/group-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      toast.success(
        action === 'accept'
          ? 'Link activated'
          : action === 'reject'
            ? 'Request rejected'
            : action === 'leave'
              ? 'Left group'
              : 'Link revoked'
      );
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const submitLink = async () => {
    let peerProfileId = selectedPeer?.id
      ? Number(selectedPeer.id)
      : Number(peerIdManual);
    if (!Number.isFinite(peerProfileId) || peerProfileId <= 0) {
      toast.message('Select a company or enter its ID');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/business/group-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          peerProfileId,
          linkType,
          asRole,
          ownershipPct: ownershipPct || undefined,
          roleLabel: roleLabel || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      if (data.autoActivated) {
        toast.success('Link created and activated (you manage both companies)');
      } else if (data.alreadyExists) {
        toast.message(data.message || 'Link already exists');
      } else {
        toast.success(
          asRole === 'parent'
            ? 'Invitation sent — the other company must accept'
            : 'Request sent — the holding/association must accept'
        );
      }
      setShowForm(false);
      setSelectedPeer(null);
      setSearchQ('');
      setPeerIdManual('');
      setOwnershipPct('');
      setRoleLabel('');
      setNotes('');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BusinessPage>
      <BusinessHeader
        title="Company group"
        titleAccent="Holding & associations"
        description="Link this company to a holding company, invite subsidiaries, or join an industry association."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0a2540] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0d3356]"
            >
              <Plus className="h-3.5 w-3.5" />
              {showForm ? 'Close' : 'New link'}
            </button>
          </div>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Group links not fully available</p>
          <p className="mt-1 text-amber-800/90">{warning}</p>
          {(hint || MIGRATION_HINT) && (
            <p className="mt-1 font-mono text-xs text-amber-700">
              {hint || MIGRATION_HINT}
            </p>
          )}
        </div>
      )}

      {/* Telemetry */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Network}
          label="Active links"
          value={summary?.active ?? '—'}
        />
        <StatCard
          icon={Building2}
          label="Holding links"
          value={summary?.holdings ?? '—'}
        />
        <StatCard
          icon={Users}
          label="Associations"
          value={summary?.associations ?? '—'}
        />
        <StatCard
          icon={GitBranch}
          label="Awaiting action"
          value={byBucket.pendingIn.length}
        />
      </div>

      {parentDisplay && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm">
          <Landmark className="h-4 w-4 shrink-0 text-violet-600" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">
              Holding parent (profile tree)
            </p>
            <p className="font-medium text-neutral-900">{parentDisplay}</p>
          </div>
        </div>
      )}

      {/* Composer */}
      {showForm && (
        <Panel className="mb-6 p-5">
          <SectionLabel>Create relationship</SectionLabel>
          <p className="mb-4 text-sm text-neutral-600">
            Search for a company on SupplierAdvisor, choose the relationship type,
            and whether you are the parent organisation or the joining member.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-neutral-500">
                Relationship type
              </span>
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as GroupLinkType)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                {GROUP_LINK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-neutral-500">
                {meta.description}
              </span>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-neutral-500">
                Our role
              </span>
              <select
                value={asRole}
                onChange={(e) =>
                  setAsRole(e.target.value as 'child' | 'parent')
                }
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="child">
                  We join them ({meta.childLabel} → their {meta.parentLabel})
                </option>
                <option value="parent">
                  They join us (we are {meta.parentLabel})
                </option>
              </select>
            </label>

            {linkType === 'holding' && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-neutral-500">
                  Ownership % (optional)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={ownershipPct}
                  onChange={(e) => setOwnershipPct(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            )}

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-neutral-500">
                Role label (optional)
              </span>
              <input
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
                placeholder="e.g. Wholly owned subsidiary"
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4">
            <span className="mb-1 block text-xs font-medium text-neutral-500">
              Find company
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setSelectedPeer(null);
                }}
                placeholder="Trading name or legal name…"
                className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />
              )}
            </div>
            {searchHits.length > 0 && !selectedPeer && (
              <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                {searchHits.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPeer(c);
                        setSearchQ(
                          c.display_name ||
                            displayCompanyName(c, Number(c.id))
                        );
                        setPeerIdManual(String(c.id));
                      }}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-sky-50"
                    >
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                      <span>
                        <span className="font-medium text-neutral-900">
                          {c.display_name ||
                            displayCompanyName(c, Number(c.id))}
                        </span>
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          {[c.industry, c.city, c.country]
                            .filter(Boolean)
                            .join(' · ')}
                          {c.verification_status === 'verified'
                            ? ' · Verified'
                            : ''}
                          {' · '}#{c.id}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedPeer && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Selected:{' '}
                <strong>
                  {selectedPeer.display_name ||
                    displayCompanyName(selectedPeer, Number(selectedPeer.id))}
                </strong>{' '}
                (#{selectedPeer.id})
              </p>
            )}
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs font-medium text-neutral-500">
                Or enter company ID
              </span>
              <input
                value={peerIdManual}
                onChange={(e) => {
                  setPeerIdManual(e.target.value);
                  setSelectedPeer(null);
                }}
                placeholder="Numeric profile id"
                className="w-full max-w-xs rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs font-medium text-neutral-500">
              Notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              placeholder="Context for the other party…"
            />
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitLink()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0a2540] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d3356] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {asRole === 'parent' ? 'Send invitation' : 'Send request'}
            </button>
          </div>
        </Panel>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['all', 'pending', 'active', 'left', 'revoked'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
              statusFilter === s
                ? 'border-[#0a2540] bg-[#0a2540] text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : links.length === 0 ? (
        <Panel className="p-5">
          <div className="py-10 text-center">
            <Network className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-800">
              No group relationships yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
              Link this company under a holding company, invite a subsidiary, or
              join an association so multi-entity reporting and governance stay
              connected.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0a2540] px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Create first link
            </button>
          </div>
        </Panel>
      ) : (
        <div className="space-y-6">
          {byBucket.pendingIn.length > 0 && (
            <LinkSection
              title="Needs your response"
              icon={GitBranch}
              links={byBucket.pendingIn}
              companyId={companyId}
              busyId={busyId}
              onAct={act}
              highlight
            />
          )}
          {byBucket.holdings.length > 0 && (
            <LinkSection
              title="Holding structure"
              icon={Landmark}
              links={byBucket.holdings}
              companyId={companyId}
              busyId={busyId}
              onAct={act}
            />
          )}
          {byBucket.associations.length > 0 && (
            <LinkSection
              title="Associations"
              icon={Users}
              links={byBucket.associations}
              companyId={companyId}
              busyId={busyId}
              onAct={act}
            />
          )}
          {byBucket.other.length > 0 && (
            <LinkSection
              title="Other group links"
              icon={Network}
              links={byBucket.other}
              companyId={companyId}
              busyId={busyId}
              onAct={act}
            />
          )}
        </div>
      )}
    </BusinessPage>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function LinkSection({
  title,
  icon: Icon,
  links,
  companyId,
  busyId,
  onAct,
  highlight,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  links: CompanyGroupLink[];
  companyId: number;
  busyId: number | null;
  onAct: (id: number, action: string) => void;
  highlight?: boolean;
}) {
  return (
    <Panel
      className={`p-5 ${
        highlight ? 'border-amber-200 bg-amber-50/30 ring-1 ring-amber-100' : ''
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-neutral-500" />
        <SectionLabel>{title}</SectionLabel>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
          {links.length}
        </span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {links.map((link) => (
          <LinkRow
            key={link.id}
            link={link}
            companyId={companyId}
            busy={busyId === link.id}
            onAct={onAct}
          />
        ))}
      </ul>
    </Panel>
  );
}

function LinkRow({
  link,
  companyId,
  busy,
  onAct,
}: {
  link: CompanyGroupLink;
  companyId: number;
  busy: boolean;
  onAct: (id: number, action: string) => void;
}) {
  const meta = linkTypeMeta(String(link.link_type));
  const isParent = link.role === 'parent';
  const canAccept =
    link.status === 'pending' &&
    ((link.direction === 'invite' && !isParent) ||
      (link.direction !== 'invite' && isParent));
  const canLeave = link.status === 'active' && !isParent;
  const canRevoke =
    (link.status === 'active' || link.status === 'pending') && isParent;

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-neutral-900">
            {link.peer_display_name ||
              displayCompanyName(link.peer, isParent ? link.child_profile_id : link.parent_profile_id)}
          </p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadgeClass(String(link.status))}`}
          >
            {link.status}
          </span>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
            {meta.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          {isParent ? (
            <>
              You are <strong>{meta.parentLabel}</strong>
              {link.ownership_pct != null
                ? ` · ${link.ownership_pct}% ownership`
                : ''}
            </>
          ) : (
            <>
              You are <strong>{meta.childLabel}</strong>
              {link.ownership_pct != null
                ? ` · ${link.ownership_pct}% owned`
                : ''}
            </>
          )}
          {link.role_label ? ` · ${link.role_label}` : ''}
          {link.direction === 'invite' ? ' · invitation' : ' · request'}
          {link.notes ? ` · ${link.notes}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {canAccept && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAct(link.id, 'accept')}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Accept
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAct(link.id, 'reject')}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Reject
            </button>
          </>
        )}
        {canLeave && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(link.id, 'leave')}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            <LogOut className="h-3 w-3" />
            Leave
          </button>
        )}
        {canRevoke && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(link.id, 'revoke')}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            <Ban className="h-3 w-3" />
            Revoke
          </button>
        )}
        <span className="hidden text-[10px] text-neutral-400 sm:inline">
          #{link.id} · co {companyId}
        </span>
      </div>
    </li>
  );
}
