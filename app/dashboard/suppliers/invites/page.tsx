'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Ban } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { useApiAuth } from '@/lib/client/use-api-auth';
import { inviteStatusClass, type SupplierInvitation } from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import {
  SrmBoard,
  SrmEmpty,
  SrmSearch,
  SrmSelect,
  SrmSkeleton,
  SrmToolbar,
  SrmViewSwitch,
  srmFocus,
} from '@/components/suppliers/srm/SrmDesk';
import {
  compareText,
  inviteBoardColumn,
  matchesQuery,
  type SrmView,
} from '@/lib/suppliers/srm-desk';

const INVITE_COLUMNS = [
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'revoked', label: 'Revoked' },
  { id: 'expired', label: 'Expired' },
  { id: 'other', label: 'Other' },
] as const;

export default function SupplierInvitesPage() {
  return (
    <CompanyRequired>
      <InvitesInner />
    </CompanyRequired>
  );
}

function InvitesInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const { withAuth } = useApiAuth();
  const privyUserId = getCanonicalUserId(user?.id);
  const [rows, setRows] = useState<SupplierInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<SrmView>('list');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await withAuth(`/api/suppliers/invites?${params}`);
      const data = await res.json();
      setRows(data.invitations || []);
      if (data.warning) toast.message(data.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, withAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    return rows
      .filter((inv) => (status === 'all' ? true : inv.status === status))
      .filter((inv) =>
        matchesQuery(q, [inv.company_name, inv.email, inv.full_name, inv.status])
      )
      .sort((a, b) =>
        compareText(a.company_name || a.email || '', b.company_name || b.email || '', 'asc')
      );
  }, [rows, q, status]);

  const act = async (id: number, action: 'resend' | 'revoke') => {
    setBusy(id);
    try {
      const res = await withAuth('/api/suppliers/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          invitationId: id,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(action === 'resend' ? 'Invite resent' : 'Invite revoked');
      if (data.inviteLink) {
        try {
          await navigator.clipboard.writeText(data.inviteLink);
          toast.message('New link copied');
        } catch {
          /* ignore */
        }
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SuppliersPage>
    <div className="pb-8">
      <SuppliersHeader
        title="Supplier invitations"
        description="Pending and historical invites. Suppliers claim via secure link, activate their company, and take ownership — your book entry links automatically."
      />

      <div className="mb-6">
        <AdvisorMemberAppInvite
          kind="supplier"
          companyId={companyId}
          brand={getSelectedCompanyName()}
          audience="suppliers"
        />
      </div>

      <SrmToolbar meta={loading ? 'Loading invites…' : `${visible.length} invitation${visible.length === 1 ? '' : 's'}`}>
        <SrmSearch value={q} onChange={setQ} label="Search invitations" placeholder="Search name or email" />
        <SrmSelect
          label="Invite status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'revoked', label: 'Revoked' },
            { value: 'expired', label: 'Expired' },
          ]}
        />
        <SrmViewSwitch value={view} onChange={setView} />
      </SrmToolbar>

      {loading ? (
        <SrmSkeleton rows={4} />
      ) : visible.length === 0 ? (
        <SrmEmpty
          title="No invitations in this view"
          description="Invite a supplier who is not on SupplierAdvisor® yet. They claim the link and the book entry links itself."
          actionHref="/dashboard/suppliers/add"
          actionLabel="Invite a supplier"
        />
      ) : view === 'board' ? (
        <SrmBoard
          columns={INVITE_COLUMNS}
          items={visible}
          columnOf={(inv) => inviteBoardColumn(inv.status)}
          renderItem={(inv) => (
            <InviteCard key={inv.id} inv={inv} busy={busy} onAct={act} />
          )}
        />
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{inv.company_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${inviteStatusClass(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <InviteActions inv={inv} busy={busy} onAct={act} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {visible.map((inv) => (
            <li key={inv.id} className="px-5 py-4">
              <InviteCard inv={inv} busy={busy} onAct={act} />
            </li>
          ))}
        </ul>
      )}
    </div>
    </SuppliersPage>
  );
}

function InviteActions({
  inv,
  busy,
  onAct,
}: {
  inv: SupplierInvitation;
  busy: number | null;
  onAct: (id: number, action: 'resend' | 'revoke') => void;
}) {
  if (inv.status !== 'pending') return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy === inv.id}
        onClick={() => void onAct(inv.id, 'resend')}
        className={`${srmFocus} btn-secondary !px-3 !py-1.5 text-xs`}
      >
        <RefreshCw className="h-3 w-3" /> Resend
      </button>
      <button
        type="button"
        disabled={busy === inv.id}
        onClick={() => void onAct(inv.id, 'revoke')}
        className={`${srmFocus} inline-flex items-center gap-1 px-2 text-xs font-semibold text-rose-700`}
      >
        <Ban className="h-3 w-3" /> Revoke
      </button>
    </div>
  );
}

function InviteCard({
  inv,
  busy,
  onAct,
}: {
  inv: SupplierInvitation;
  busy: number | null;
  onAct: (id: number, action: 'resend' | 'revoke') => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="min-w-0">
        <div className="font-semibold text-slate-900">{inv.company_name || inv.email}</div>
        <div className="text-xs text-slate-600">
          {inv.email}
          {inv.full_name ? ` · ${inv.full_name}` : ''}
          {inv.expires_at ? ` · expires ${new Date(inv.expires_at).toLocaleDateString()}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${inviteStatusClass(inv.status)}`}>
          {inv.status}
        </span>
        <InviteActions inv={inv} busy={busy} onAct={onAct} />
      </div>
    </div>
  );
}
