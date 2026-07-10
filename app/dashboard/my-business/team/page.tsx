'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, UserPlus, Trash2, Copy, RefreshCw, Shield } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  memberStatusClass,
  roleBadgeClass,
  type TeamMember,
} from '@/lib/business/types';
import {
  ROLE_PERMISSIONS,
  TEAM_ROLE_OPTIONS,
  type PermissionResource,
  type TeamRole,
} from '@/lib/business/permissions';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { KpiCard, Panel } from '@/components/relationship/RelationshipChrome';

type MembershipMe = {
  memberId?: number;
  role: string;
  roleLabel: string;
  rights: string;
  canManageTeam: boolean;
};

type MatrixRow = {
  resource: string;
  label: string;
  level: string;
  levelLabel: string;
};

export default function BusinessTeamPage() {
  return (
    <CompanyRequired>
      <TeamInner />
    </CompanyRequired>
  );
}

function TeamInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [counts, setCounts] = useState({ total: 0, active: 0, invited: 0, owners: 0 });
  const [me, setMe] = useState<MembershipMe | null>(null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'member' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const [teamRes, memRes] = await Promise.all([
        fetch(`/api/business/team?${params}`),
        fetch(`/api/business/membership?${params}`),
      ]);
      const teamData = await teamRes.json();
      if (!teamRes.ok) throw new Error(teamData.error || 'Failed to load team');
      setMembers(teamData.members || []);
      setCounts(teamData.counts || counts);
      setCompanyName(
        teamData.company?.trading_name || teamData.company?.legal_name || 'Your company'
      );

      if (memRes.ok) {
        const memData = await memRes.json();
        setMe(memData.membership || null);
        setMatrix(memData.matrix || []);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = me?.canManageTeam === true;
  const myMemberId = me?.memberId != null ? Number(me.memberId) : null;
  const isAdmin = me?.role === 'admin';
  const isOwner = me?.role === 'owner';
  /** Admins may promote themselves to Owner; owners may assign Owner to anyone. */
  const canAssignOwnerTo = (memberId: number) =>
    isOwner || (isAdmin && myMemberId != null && memberId === myMemberId);

  const invite = async () => {
    if (!form.email.trim()) {
      toast.error('Email required');
      return;
    }
    if (!canManage) {
      toast.error('Only owners and admins can invite team members');
      return;
    }
    setInviting(true);
    setLastInviteLink(null);
    try {
      const res = await fetch('/api/invite-team-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          name: form.name,
          email: form.email.trim().toLowerCase(),
          role: form.role || 'member',
          companyName,
          inviterName:
            user?.email?.address ||
            (user as { google?: { name?: string } })?.google?.name ||
            'Your teammate',
        }),
      });
      const data = await res.json();
      if (data.inviteLink) setLastInviteLink(String(data.inviteLink));

      if (!res.ok) {
        // 502 = saved but email failed — still useful
        if (res.status === 502 && data.inviteLink) {
          toast.error(
            data.details
              ? `Email failed: ${data.details}. Copy the invite link below.`
              : data.error || 'Email failed — copy invite link below'
          );
          void load();
          return;
        }
        throw new Error(
          [data.error, data.details, data.hint].filter(Boolean).join(' — ') ||
            'Invite failed'
        );
      }
      toast.success(data.message || 'Invitation sent via email');
      setForm({ name: '', email: '', role: 'member' });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const updateRole = async (memberId: number, role: string) => {
    if (!canManage) {
      toast.error('Only owners and admins can change roles');
      return;
    }
    if (role === 'owner' && !canAssignOwnerTo(memberId)) {
      toast.error('Admins may only promote their own profile to Owner');
      return;
    }
    setBusyId(memberId);
    try {
      const res = await fetch('/api/business/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, memberId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success(
        role === 'owner' && myMemberId === memberId
          ? 'You are now Owner'
          : 'Role updated'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (memberId: number) => {
    if (!canManage) {
      toast.error('Only owners and admins can remove members');
      return;
    }
    if (!confirm('Remove this team member?')) return;
    setBusyId(memberId);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        memberId: String(memberId),
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/team?${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Remove failed');
      toast.success('Member removed');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const roleHelp = TEAM_ROLE_OPTIONS.find((r) => r.value === form.role);

  return (
    <BusinessPage>
      <BusinessHeader
        title="Team"
        titleAccent="& roles"
        description={`People with access to ${companyName}. Invites are emailed via Resend. Your role: ${me?.roleLabel || '…'} (${me?.rights || 'loading'}).`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard label="Total" value={counts.total} loading={loading} />
        <KpiCard label="Active" value={counts.active} tone="emerald" loading={loading} />
        <KpiCard label="Invited" value={counts.invited} tone="amber" loading={loading} />
        <KpiCard label="Owners" value={counts.owners} tone="cyan" loading={loading} />
      </div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
        <Panel title="Invite member" className="lg:col-span-2">
          <div className="p-5 space-y-3">
            {!canManage && !loading && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Your role is <strong>{me?.roleLabel || 'view only'}</strong>. Only owners and
                admins can send invitations or change roles.
              </div>
            )}
            <input
              className="input w-full !p-3 !text-sm"
              placeholder="Full name"
              value={form.name}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="email"
              className="input w-full !p-3 !text-sm"
              placeholder="Email *"
              value={form.email}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <select
              className="input w-full !p-3 !text-sm"
              value={form.role}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {TEAM_ROLE_OPTIONS.filter((r) => r.value !== 'owner' || isOwner).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.rights}
                </option>
              ))}
            </select>
            {roleHelp && (
              <p className="text-[11px] text-neutral-500 leading-relaxed">{roleHelp.description}</p>
            )}
            <button
              type="button"
              disabled={inviting || !canManage}
              onClick={() => void invite()}
              className="btn-primary w-full !py-3 text-sm disabled:opacity-50"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Send invite email
                </>
              )}
            </button>

            {lastInviteLink && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 space-y-2">
                <p className="text-[11px] text-sky-900 font-semibold">
                  Share this link if email is delayed
                </p>
                <p className="text-[10px] font-mono text-sky-800 break-all">{lastInviteLink}</p>
                <button
                  type="button"
                  onClick={() => void copyLink(lastInviteLink)}
                  className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy link
                </button>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Members" className="lg:col-span-3">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">No team members yet.</div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {members
                .filter((m) => m.status !== 'removed')
                .map((m) => {
                  const roleMeta = TEAM_ROLE_OPTIONS.find(
                    (r) => r.value === String(m.role || 'member').toLowerCase()
                  );
                  return (
                    <li
                      key={m.id}
                      className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {m.name || m.email || m.invited_email || 'Member'}
                        </div>
                        <div className="text-xs text-neutral-500 truncate">
                          {m.email || m.invited_email || '—'}
                        </div>
                        {roleMeta && (
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            {roleMeta.rights}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${memberStatusClass(m.status)}`}
                        >
                          {m.status || 'active'}
                        </span>
                        <select
                          className="input !py-1.5 !px-2 !text-xs !w-auto"
                          value={(() => {
                            const raw = String(m.role || 'member');
                            const known = TEAM_ROLE_OPTIONS.some((r) => r.value === raw);
                            if (known) return raw;
                            // Map legacy free-text titles (e.g. CEO) via normalized option if present
                            return raw;
                          })()}
                          disabled={busyId === m.id || !canManage}
                          onChange={(e) => void updateRole(m.id, e.target.value)}
                          title={
                            canManage
                              ? isAdmin && myMemberId === m.id
                                ? 'You can promote yourself to Owner'
                                : 'Change role'
                              : 'View only — cannot change roles'
                          }
                        >
                          {/* Preserve legacy free-text role values as selectable until changed */}
                          {m.role &&
                            !TEAM_ROLE_OPTIONS.some((r) => r.value === String(m.role)) && (
                              <option value={String(m.role)}>{String(m.role)} (current)</option>
                            )}
                          {TEAM_ROLE_OPTIONS.filter(
                            (r) => r.value !== 'owner' || canAssignOwnerTo(m.id)
                          ).map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                              {r.value === 'owner' &&
                              isAdmin &&
                              myMemberId === m.id
                                ? ' (promote me)'
                                : ''}
                            </option>
                          ))}
                        </select>
                        <span
                          className={`hidden sm:inline text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${roleBadgeClass(m.role)}`}
                        >
                          {m.role}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            onClick={() => void remove(m.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Rights matrix */}
      <Panel title="Role rights" className="mt-5">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 text-sm text-neutral-600">
            <Shield className="w-4 h-4 text-[#00b4d8] mt-0.5 shrink-0" />
            <p>
              Invite <strong>Sales contractor</strong> for a branded sales-team email. They only
              access the dedicated <strong>/sales</strong> portal (not the main ERP) — agreement,
              commission <strong>3.5% → 5.5%</strong>, R199×6 sub. <strong>Owners and finance</strong>{' '}
              get free full sales portal access. All CRM data stays under your company.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-200 text-[10px] uppercase tracking-wider text-neutral-400">
                  <th className="py-2 pr-3 font-semibold">Area</th>
                  {TEAM_ROLE_OPTIONS.map((r) => (
                    <th key={r.value} className="py-2 px-1.5 font-semibold text-center">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    'overview',
                    'profile',
                    'team',
                    'settings',
                    'legal',
                    'documents',
                    'projects',
                    'riad',
                    'banking',
                    'verification',
                    'invites',
                    'customers',
                    'suppliers',
                    'containers',
                    'network',
                    'inventory',
                    'operations',
                    'accounting',
                  ] as PermissionResource[]
                ).map((resource) => (
                  <tr key={resource} className="border-b border-neutral-100">
                    <td className="py-2 pr-3 font-medium text-slate-700 capitalize">
                      {resource === 'riad' ? 'RIAD' : resource}
                    </td>
                    {TEAM_ROLE_OPTIONS.map((r) => {
                      const level =
                        ROLE_PERMISSIONS[r.value as TeamRole][resource];
                      const label =
                        level === 'admin'
                          ? 'Admin'
                          : level === 'write'
                            ? 'R/W'
                            : level === 'view'
                              ? 'View'
                              : '—';
                      const tone =
                        level === 'admin'
                          ? 'bg-sky-100 text-sky-800'
                          : level === 'write'
                            ? 'bg-emerald-100 text-emerald-800'
                            : level === 'view'
                              ? 'bg-neutral-100 text-neutral-600'
                              : 'bg-white text-neutral-300';
                      return (
                        <td key={r.value} className="py-2 px-1.5 text-center">
                          <span
                            className={`inline-block min-w-[2.5rem] text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${tone}`}
                          >
                            {label}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {me && (
            <p className="text-[11px] text-neutral-500">
              You are signed in as <strong>{me.roleLabel}</strong>
              {fromApiSelf(matrix) ? ` · ${fromApiSelf(matrix)}` : ''}.
            </p>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh team
          </button>
        </div>
      </Panel>
    </BusinessPage>
  );
}

function fromApiSelf(matrix: MatrixRow[]) {
  if (!matrix.length) return '';
  const writes = matrix.filter((m) => m.level === 'write' || m.level === 'admin').length;
  const views = matrix.filter((m) => m.level === 'view').length;
  return `${writes} write areas · ${views} view-only`;
}
