'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, UserPlus, Trash2 } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  TEAM_ROLES,
  memberStatusClass,
  roleBadgeClass,
  type TeamMember,
} from '@/lib/business/types';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { KpiCard, Panel } from '@/components/relationship/RelationshipChrome';

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
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'member' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/team?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setMembers(data.members || []);
      setCounts(data.counts || counts);
      setCompanyName(
        data.company?.trading_name || data.company?.legal_name || 'Your company'
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async () => {
    if (!form.email.trim()) {
      toast.error('Email required');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/invite-team-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name: form.name,
          email: form.email.trim().toLowerCase(),
          role: form.role || 'member',
          companyName,
          invitedBy: user?.id,
          inviterName:
            user?.email?.address ||
            (user as { google?: { name?: string } })?.google?.name ||
            'Your teammate',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(data.warning || 'Invitation sent');
      setForm({ name: '', email: '', role: 'member' });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (memberId: number, role: string) => {
    setBusyId(memberId);
    try {
      const res = await fetch('/api/business/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, memberId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success('Role updated');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (memberId: number) => {
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

  return (
    <BusinessPage>
      <BusinessHeader
        title="Team &"
        titleAccent="roles"
        description={`People with access to ${companyName}. Invites go through Resend; membership is membership-checked on every action.`}
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
            <input
              className="input w-full !p-3 !text-sm"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="email"
              className="input w-full !p-3 !text-sm"
              placeholder="Email *"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <select
              className="input w-full !p-3 !text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {TEAM_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={inviting}
              onClick={() => void invite()}
              className="btn-primary w-full !py-3 text-sm"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Send invite
                </>
              )}
            </button>
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
                .map((m) => (
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${memberStatusClass(m.status)}`}
                      >
                        {m.status || 'active'}
                      </span>
                      <select
                        className="input !py-1.5 !px-2 !text-xs !w-auto"
                        value={m.role || 'member'}
                        disabled={busyId === m.id}
                        onChange={(e) => void updateRole(m.id, e.target.value)}
                      >
                        {TEAM_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <span
                        className={`hidden sm:inline text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${roleBadgeClass(m.role)}`}
                      >
                        {m.role}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => void remove(m.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
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
