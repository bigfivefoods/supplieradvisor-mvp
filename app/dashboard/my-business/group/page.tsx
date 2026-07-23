'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
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
  Inbox,
  Clock,
  HelpCircle,
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
  inviteCopy,
  isActionablePending,
  isAwaitingPeer,
  linkTypeMeta,
  statusBadgeClass,
  MIGRATION_HINT,
} from '@/lib/business/company-groups';
import type { StructureTree } from '@/lib/business/group-structure';
import GroupStructureDiagram from '@/components/business/GroupStructureDiagram';

type Summary = {
  total: number;
  pending: number;
  actionable?: number;
  awaiting?: number;
  active: number;
  as_parent: number;
  as_child: number;
  holdings: number;
  associations: number;
};

type SearchHit = GroupPeerProfile & { display_name?: string };

type ActionableLink = CompanyGroupLink & {
  copy?: ReturnType<typeof inviteCopy>;
  can_accept?: boolean;
};

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
  const [actionable, setActionable] = useState<ActionableLink[]>([]);
  const [awaiting, setAwaiting] = useState<ActionableLink[]>([]);
  const [structure, setStructure] = useState<StructureTree[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [parentDisplay, setParentDisplay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  // Composer
  const [showForm, setShowForm] = useState(false);
  const [linkType, setLinkType] = useState<GroupLinkType>('association');
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
      const list = (data.links || []) as CompanyGroupLink[];
      setLinks(list);
      setActionable(
        (data.actionable as ActionableLink[]) ||
          list
            .filter((l) => isActionablePending(l, companyId))
            .map((l) => ({ ...l, copy: inviteCopy(l) }))
      );
      setAwaiting(
        (data.awaiting as ActionableLink[]) ||
          list
            .filter((l) => isAwaitingPeer(l, companyId))
            .map((l) => ({ ...l, copy: inviteCopy(l) }))
      );
      setSummary(data.summary || null);
      setParentDisplay(data.parent_display_name || null);
      setStructure(Array.isArray(data.structure) ? data.structure : []);
      setWarning(data.warning || null);
      setHint(data.hint || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load group links');
      setLinks([]);
      setActionable([]);
      setAwaiting([]);
      setStructure([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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
    // Hide pure pending from lists — they live in inbox sections
    const notPending = (l: CompanyGroupLink) => l.status !== 'pending';
    return {
      holdings: holdings.filter(notPending),
      associations: associations.filter(notPending),
      other: other.filter(notPending),
    };
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
          ? 'Accepted — link is now active'
          : action === 'reject'
            ? 'Declined'
            : action === 'cancel'
              ? 'Cancelled'
              : action === 'leave'
                ? 'Left group'
                : 'Revoked'
      );
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const submitLink = async () => {
    const peerProfileId = selectedPeer?.id
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
        toast.success('Linked and activated (you manage both companies)');
      } else if (data.alreadyExists) {
        toast.message(data.message || 'Link already exists');
      } else {
        toast.success(
          asRole === 'parent'
            ? 'Invitation sent. They accept under Company → Group while logged into their company.'
            : 'Request sent. They accept under Company → Group.'
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
        description="Invite members, join a holding or association, and accept invitations in one place."
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
              {showForm ? 'Close' : 'Invite or join'}
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

      {/* Group structure diagram */}
      {!loading && (
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <SectionLabel>Group structure</SectionLabel>
              <p className="text-xs text-neutral-500 -mt-1 mb-2">
                Full chain visibility: Holding → subsidiary → sub-sub, with ownership %
                on each link when set. Associations list members under the body.
              </p>
            </div>
          </div>
          <GroupStructureDiagram
            trees={structure}
            emptyHint="No active structure yet. After invitations are accepted, multi-level holding and association trees appear here (including companies owned by your subsidiaries)."
          />
        </div>
      )}

      {/* How to accept — always visible, simple */}
      <Panel className="mb-6 overflow-hidden border-sky-100 bg-gradient-to-br from-sky-50/80 to-white">
        <div className="flex gap-3 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-white text-[#0077b6]">
            <HelpCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-2 text-sm text-slate-700">
            <p className="font-bold text-slate-900">How invitations work</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-slate-600">
              <li>
                <strong>Invite or join</strong> — search for the other company and send
                an invitation (or request to join them). Set ownership % for holdings.
              </li>
              <li>
                <strong>Switch company</strong> — the person who accepts must open this
                app as the <em>invited</em> company (top company switcher if they have more
                than one).
              </li>
              <li>
                <strong>Accept here</strong> — open{' '}
                <strong>Company → Group</strong>. Pending invitations appear at the top
                with <strong>Accept</strong> / <strong>Decline</strong>.
              </li>
            </ol>
            <p className="text-[12px] text-slate-500">
              If you manage both companies, the link activates immediately when you send
              it — no second accept needed.
            </p>
          </div>
        </div>
      </Panel>

      {/* ═══ SIMPLE ACCEPT INBOX ═══ */}
      {loading ? (
        <div className="mb-6 flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : actionable.length > 0 ? (
        <section className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-black text-slate-900">
              Invitations to review
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
              {actionable.length}
            </span>
          </div>
          {actionable.map((link) => {
            const copy = link.copy || inviteCopy(link);
            const busy = busyId === link.id;
            return (
              <div
                key={link.id}
                className="overflow-hidden rounded-2xl border-2 border-amber-200 bg-white shadow-sm ring-1 ring-amber-100"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        Action needed
                      </span>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                        {linkTypeMeta(String(link.link_type)).label}
                      </span>
                    </div>
                    <p className="text-base font-bold leading-snug text-slate-900">
                      {copy.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {copy.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act(link.id, 'accept')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {copy.ctaAccept}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act(link.id, 'reject')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      {copy.ctaDecline}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <div className="mb-6 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-4 text-center text-sm text-neutral-500">
          No invitations waiting for this company. When someone invites you,{' '}
          <strong className="text-slate-700">Accept</strong> and{' '}
          <strong className="text-slate-700">Decline</strong> show here.
        </div>
      )}

      {/* Waiting on them */}
      {awaiting.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-400" />
            <h2 className="text-sm font-bold text-slate-800">
              Waiting for the other company
            </h2>
          </div>
          <ul className="space-y-2">
            {awaiting.map((link) => {
              const copy = link.copy || inviteCopy(link);
              const busy = busyId === link.id;
              return (
                <li
                  key={link.id}
                  className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {link.peer_display_name || 'Company'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {linkTypeMeta(String(link.link_type)).label}
                      {link.direction === 'invite'
                        ? ' · invitation sent'
                        : ' · join request sent'}
                      {' · '}
                      they accept under Company → Group on their side
                    </p>
                    {link.notes && (
                      <p className="mt-0.5 text-xs text-neutral-400">{link.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(link.id, 'cancel')}
                    className="inline-flex items-center gap-1.5 self-start rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Ban className="h-3 w-3" />
                    )}
                    Cancel
                  </button>
                  {/* silence unused copy in this list */}
                  <span className="sr-only">{copy.title}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Telemetry */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Inbox}
          label="To review"
          value={actionable.length}
        />
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
      </div>

      {parentDisplay && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm">
          <Landmark className="h-4 w-4 shrink-0 text-violet-600" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">
              Holding parent
            </p>
            <p className="font-medium text-neutral-900">{parentDisplay}</p>
          </div>
        </div>
      )}

      {/* Composer */}
      {showForm && (
        <Panel className="mb-6 p-5">
          <SectionLabel>Invite or join</SectionLabel>
          <p className="mb-4 text-sm text-neutral-600">
            Search for a company already on SupplierAdvisor. They will see a simple
            Accept / Decline on their Group page.
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
                What are you doing?
              </span>
              <select
                value={asRole}
                onChange={(e) =>
                  setAsRole(e.target.value as 'child' | 'parent')
                }
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="child">
                  Join them (we become their {meta.childLabel.toLowerCase()})
                </option>
                <option value="parent">
                  Invite them (we are the {meta.parentLabel.toLowerCase()})
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
                Note for them (optional)
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
              Message (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              placeholder="Shown to the other company when they accept…"
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
              {asRole === 'parent' ? 'Send invitation' : 'Send join request'}
            </button>
          </div>
        </Panel>
      )}

      {/* Filters for history */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          History
        </span>
        {(['all', 'active', 'left', 'revoked', 'rejected'] as const).map((s) => (
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

      {!loading &&
      byBucket.holdings.length === 0 &&
      byBucket.associations.length === 0 &&
      byBucket.other.length === 0 &&
      actionable.length === 0 &&
      awaiting.length === 0 ? (
        <Panel className="p-5">
          <div className="py-10 text-center">
            <Network className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-800">
              No group relationships yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
              Invite a subsidiary, join a holding company, or join an association.
              The other company accepts with one click on their Group page.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0a2540] px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Invite or join
            </button>
          </div>
        </Panel>
      ) : (
        !loading && (
          <div className="space-y-6">
            {byBucket.holdings.length > 0 && (
              <LinkSection
                title="Holding structure"
                icon={Landmark}
                links={byBucket.holdings}
                busyId={busyId}
                onAct={act}
              />
            )}
            {byBucket.associations.length > 0 && (
              <LinkSection
                title="Associations"
                icon={Users}
                links={byBucket.associations}
                busyId={busyId}
                onAct={act}
              />
            )}
            {byBucket.other.length > 0 && (
              <LinkSection
                title="Other group links"
                icon={Network}
                links={byBucket.other}
                busyId={busyId}
                onAct={act}
              />
            )}
          </div>
        )
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
    <div className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon className="h-3.5 w-3.5 shrink-0" />
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
  busyId,
  onAct,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  links: CompanyGroupLink[];
  busyId: number | null;
  onAct: (id: number, action: string) => void;
}) {
  return (
    <Panel className="p-5">
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
  busy,
  onAct,
}: {
  link: CompanyGroupLink;
  busy: boolean;
  onAct: (id: number, action: string) => void;
}) {
  const meta = linkTypeMeta(String(link.link_type));
  const isParent = link.role === 'parent';
  const canLeave = link.status === 'active' && !isParent;
  const canRevoke = link.status === 'active' && isParent;

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-neutral-900">
            {link.peer_display_name ||
              displayCompanyName(
                link.peer,
                isParent ? link.child_profile_id : link.parent_profile_id
              )}
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
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
      </div>
    </li>
  );
}
