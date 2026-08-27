'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  UserPlus,
  Trash2,
  Copy,
  RefreshCw,
  Shield,
  LayoutGrid,
  ChevronDown,
  Clock3,
} from 'lucide-react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  isListedTeamMember,
  memberStatusClass,
  roleBadgeClass,
  teamLastLoginAt,
  type TeamMember,
} from '@/lib/business/types';
import { portalTimeAgo, portalWhen } from '@/lib/portals/portal-activity';
import {
  ROLE_PERMISSIONS,
  TEAM_ROLE_OPTIONS,
  type PermissionResource,
  type TeamRole,
} from '@/lib/business/permissions';
import {
  isModuleEnabled,
  type EnabledModulesMap,
  type CompanyModuleOption,
} from '@/lib/business/company-modules';
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
  const { withAuth, withAuthJson } = useApiAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [counts, setCounts] = useState({ total: 0, active: 0, invited: 0, owners: 0 });
  const [me, setMe] = useState<MembershipMe | null>(null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [companyModules, setCompanyModules] = useState<EnabledModulesMap>({});
  const [moduleOptions, setModuleOptions] = useState<CompanyModuleOption[]>([]);
  const [modulesOpenId, setModulesOpenId] = useState<number | null>(null);
  const [draftModules, setDraftModules] = useState<EnabledModulesMap>({});
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'member' });
  const [inviteModules, setInviteModules] = useState<EnabledModulesMap>({});

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
      if (teamData.companyModules) {
        setCompanyModules(teamData.companyModules as EnabledModulesMap);
      }
      if (Array.isArray(teamData.moduleOptions)) {
        setModuleOptions(teamData.moduleOptions as CompanyModuleOption[]);
      }

      if (memRes.ok) {
        const memData = await memRes.json();
        setMe(memData.membership || null);
        setMatrix(memData.matrix || []);
        if (memData.companyModules) {
          setCompanyModules(memData.companyModules as EnabledModulesMap);
        }
        if (Array.isArray(memData.moduleOptions) && !teamData.moduleOptions?.length) {
          setModuleOptions(memData.moduleOptions as CompanyModuleOption[]);
        }
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
      const inheritAll =
        form.role === 'owner' ||
        assignableModules.length === 0 ||
        !assignableModules.some((o) => inviteModules[o.id] === false);
      const res = await withAuth('/api/invite-team-member', {
        method: 'POST',
        jsonBody: {
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
          allowedModules:
            inheritAll || form.role === 'owner' ? undefined : inviteModules,
        },
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
      const link = String(data.inviteLink || data.joinUrl || '');
      if (link) setLastInviteLink(link);
      toast.success(
        data.message ||
          'Invitation sent via email with join link'
      );
      if (link) {
        toast.message('Join link is in the email — you can also copy it below', {
          duration: 6000,
        });
      }
      const { toastGoldenPathFromResponse } = await import(
        '@/lib/onboarding/toast-client'
      );
      toastGoldenPathFromResponse(data);
      setForm({ name: '', email: '', role: 'member' });
      setInviteModules((prev) => {
        const seed: EnabledModulesMap = {};
        for (const [k] of Object.entries(prev)) seed[k] = true;
        return seed;
      });
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
      await withAuthJson('/api/business/team', {
        method: 'PATCH',
        jsonBody: { companyId, privyUserId, memberId, role },
      });
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
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  /** Resend invite email + refresh token for invited / pending members */
  const reinvite = async (member: TeamMember) => {
    if (!canManage) {
      toast.error('Only owners and admins can reinvite team members');
      return;
    }
    const email = String(member.invited_email || member.email || '')
      .toLowerCase()
      .trim();
    if (!email || !email.includes('@')) {
      toast.error('This member has no email address to reinvite');
      return;
    }
    const status = String(member.status || '').toLowerCase();
    if (status === 'active') {
      toast.error('This person is already an active member');
      return;
    }
    setBusyId(member.id);
    setLastInviteLink(null);
    try {
      const res = await fetch('/api/invite-team-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          name: member.name || '',
          email,
          role: member.role || 'member',
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
            'Reinvite failed'
        );
      }
      toast.success(data.message || 'Invitation resent via email');
      if (data.inviteLink) {
        toast.message('Fresh join link is ready to copy below if needed', {
          duration: 5000,
        });
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reinvite failed');
    } finally {
      setBusyId(null);
    }
  };

  const canReinvite = (m: TeamMember) => {
    const status = String(m.status || '').toLowerCase();
    return ['invited', 'pending'].includes(status);
  };

  /** Company-enabled modules the owner can assign to users (exclude always-on) */
  const assignableModules = moduleOptions.filter(
    (o) =>
      !o.alwaysOn &&
      o.id !== 'platform' &&
      isModuleEnabled(companyModules, o.id)
  );

  useEffect(() => {
    if (!assignableModules.length) return;
    setInviteModules((prev) => {
      const next: EnabledModulesMap = {};
      let changed = Object.keys(prev).length !== assignableModules.length;
      for (const opt of assignableModules) {
        if (prev[opt.id] === undefined) changed = true;
        next[opt.id] = prev[opt.id] === undefined ? true : prev[opt.id] === true;
      }
      return changed ? next : prev;
    });
  }, [companyModules, moduleOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModuleEditor = (m: TeamMember) => {
    if (String(m.role || '').toLowerCase() === 'owner') {
      toast.message('Owners always see all company modules');
      return;
    }
    if (modulesOpenId === m.id) {
      setModulesOpenId(null);
      return;
    }
    // Seed draft: custom allow-list, or all company-enabled modules
    const seed: EnabledModulesMap = {};
    for (const opt of assignableModules) {
      if (m.customModuleAccess && m.allowedModules) {
        seed[opt.id] = m.allowedModules[opt.id] === true;
      } else {
        seed[opt.id] = true;
      }
    }
    setDraftModules(seed);
    setModulesOpenId(m.id);
  };

  const saveMemberModules = async (memberId: number, inherit: boolean) => {
    if (!canManage) {
      toast.error('Only owners and admins can change module access');
      return;
    }
    setBusyId(memberId);
    try {
      await withAuthJson('/api/business/team', {
        method: 'PATCH',
        jsonBody: {
          companyId,
          privyUserId,
          memberId,
          clearModuleAccess: inherit,
          allowedModules: inherit ? null : draftModules,
        },
      });
      toast.success(
        inherit
          ? 'User will see all company modules on login'
          : 'Module access saved for this user'
      );
      setModulesOpenId(null);
      void load();
      window.dispatchEvent(new Event('sa:company-changed'));
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
        titleAccent="roles & modules"
        description={`People with access to ${companyName}. Choose each user’s role and which modules they see when they log in. Company-wide modules are set under Company → Modules. Your role: ${me?.roleLabel || '…'}.`}
        action={
          <Link
            href="/dashboard/my-business/modules"
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Company modules
          </Link>
        }
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
            {form.role !== 'owner' && assignableModules.length > 0 && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-violet-900">
                  Modules they can use
                </p>
                <p className="text-[10px] text-violet-900/70 leading-relaxed">
                  Saved on this person’s team profile. Leave all ticked to give
                  every company module.
                </p>
                <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto">
                  {assignableModules.map((opt) => {
                    const on = inviteModules[opt.id] === true;
                    return (
                      <label
                        key={opt.id}
                        className="flex items-start gap-2 rounded-lg bg-white/80 px-2 py-1.5 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={on}
                          disabled={!canManage}
                          onChange={() =>
                            setInviteModules((prev) => ({
                              ...prev,
                              [opt.id]: !on,
                            }))
                          }
                        />
                        <span className="font-semibold text-slate-800">
                          {opt.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
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
                  Join link (also in the invite email)
                </p>
                <p className="text-[10px] font-mono text-sky-800 break-all">
                  {lastInviteLink}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink(lastInviteLink)}
                    className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy join link
                  </button>
                  <a
                    href={lastInviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center"
                  >
                    Open join page
                  </a>
                </div>
                <p className="text-[10px] text-sky-800/80">
                  Share this URL with the person if their email is delayed or
                  filtered.
                </p>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Members" className="lg:col-span-3">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
            </div>
          ) : members.filter((m) => isListedTeamMember(m.status)).length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">No team members yet.</div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {members.filter((m) => isListedTeamMember(m.status)).map((m) => {
                  const roleMeta = TEAM_ROLE_OPTIONS.find(
                    (r) => r.value === String(m.role || 'member').toLowerCase()
                  );
                  const showReinvite = canManage && canReinvite(m);
                  const isOwnerRow =
                    String(m.role || '').toLowerCase() === 'owner';
                  const modulesOpen = modulesOpenId === m.id;
                  const lastLogin = teamLastLoginAt(m);
                  return (
                    <li key={m.id}>
                      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
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
                              {m.customModuleAccess
                                ? ' · custom modules'
                                : ' · all company modules'}
                            </div>
                          )}
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="w-3 h-3 text-neutral-400" />
                              {lastLogin
                                ? `Last login ${portalTimeAgo(lastLogin)}${
                                    portalWhen(lastLogin)
                                      ? ` · ${portalWhen(lastLogin)}`
                                      : ''
                                  }`
                                : 'Never logged in'}
                            </span>
                            {m.invited_at ? (
                              <span>Invited {portalTimeAgo(m.invited_at)}</span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${memberStatusClass(m.status)}`}
                          >
                            {m.status || 'active'}
                          </span>
                          <select
                            className="input !py-1.5 !px-2 !text-xs !w-auto"
                            value={(() => {
                              const raw = String(m.role || 'member');
                              const known = TEAM_ROLE_OPTIONS.some(
                                (r) => r.value === raw
                              );
                              if (known) return raw;
                              return raw;
                            })()}
                            disabled={busyId === m.id || !canManage}
                            onChange={(e) => void updateRole(m.id, e.target.value)}
                          >
                            {m.role &&
                              !TEAM_ROLE_OPTIONS.some(
                                (r) => r.value === String(m.role)
                              ) && (
                                <option value={String(m.role)}>
                                  {String(m.role)} (current)
                                </option>
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
                          {canManage && !isOwnerRow && (
                            <button
                              type="button"
                              onClick={() => openModuleEditor(m)}
                              className={`inline-flex items-center gap-1 !py-1.5 !px-2.5 text-xs font-semibold rounded-xl border ${
                                modulesOpen || m.customModuleAccess
                                  ? 'border-violet-300 bg-violet-50 text-violet-900'
                                  : 'border-neutral-200 bg-white text-slate-700 hover:border-violet-200'
                              }`}
                              title="Modules this user sees when they log in"
                            >
                              <LayoutGrid className="w-3.5 h-3.5" />
                              Modules
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  modulesOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          )}
                          {showReinvite && (
                            <button
                              type="button"
                              disabled={busyId === m.id}
                              onClick={() => void reinvite(m)}
                              className="inline-flex items-center gap-1 !py-1.5 !px-2.5 text-xs font-semibold rounded-xl border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                            >
                              {busyId === m.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              Reinvite
                            </button>
                          )}
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
                      </div>

                      {modulesOpen && (
                        <div className="px-5 pb-4 border-t border-violet-100 bg-violet-50/40">
                          <p className="text-[11px] text-violet-900/80 pt-3 mb-2 leading-relaxed">
                            Choose which <strong>company modules</strong> this
                            person sees after login. Always-on: Home, Company,
                            Guide. Turn modules on for the whole company under{' '}
                            <Link
                              href="/dashboard/my-business/modules"
                              className="font-semibold underline"
                            >
                              Company → Modules
                            </Link>
                            .
                          </p>
                          {assignableModules.length === 0 ? (
                            <p className="text-xs text-neutral-500 py-2">
                              No optional modules are enabled for the company
                              yet. Enable GymAdvisor, CropAdvisor, DBE, etc. under
                              Company → Modules first.
                            </p>
                          ) : (
                            <div className="grid sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
                              {assignableModules.map((opt) => {
                                const on = draftModules[opt.id] === true;
                                return (
                                  <label
                                    key={opt.id}
                                    className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 cursor-pointer text-xs ${
                                      on
                                        ? 'border-violet-300 bg-white'
                                        : 'border-neutral-200 bg-white/60 opacity-80'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-0.5"
                                      checked={on}
                                      onChange={() =>
                                        setDraftModules((prev) => ({
                                          ...prev,
                                          [opt.id]: !on,
                                        }))
                                      }
                                    />
                                    <span>
                                      <span className="font-bold text-slate-900 block">
                                        {opt.name}
                                      </span>
                                      <span className="text-[10px] text-neutral-500 line-clamp-2">
                                        {opt.description}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button
                              type="button"
                              disabled={busyId === m.id}
                              className="btn-primary !py-1.5 !px-3 text-xs"
                              onClick={() => void saveMemberModules(m.id, false)}
                            >
                              {busyId === m.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : null}{' '}
                              Save modules for user
                            </button>
                            <button
                              type="button"
                              disabled={busyId === m.id}
                              className="btn-secondary !py-1.5 !px-3 text-xs"
                              onClick={() => void saveMemberModules(m.id, true)}
                            >
                              Use all company modules
                            </button>
                          </div>
                        </div>
                      )}
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
              commission, and criteria from your{' '}
              <a
                href="/dashboard/my-business/sales-program"
                className="font-semibold text-[#0077b6] underline"
              >
                Sales program
              </a>{' '}
              settings, plus R199×6 portal sub. <strong>Owners and finance</strong> get free full
              sales portal access. All CRM data stays under your company.
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
