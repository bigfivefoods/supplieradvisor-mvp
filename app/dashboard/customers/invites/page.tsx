'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Mail,
  RefreshCw,
  Ban,
  UserPlus,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CUSTOMER_INVITATION_STATUSES,
  invitationAttemptStatusClass,
  type CustomerInvitationRecord,
  type CustomerRecord,
} from '@/lib/customers/types';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';
import InviteCustomerButton from '@/components/customers/InviteCustomerButton';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'claiming', label: 'Claiming' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
] as const;

export default function CustomerInvitesPage() {
  return (
    <CompanyRequired>
      <InvitesInner />
    </CompanyRequired>
  );
}

function InvitesInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [invitations, setInvitations] = useState<CustomerInvitationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('pending');
  const [actionId, setActionId] = useState<number | null>(null);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [pickedCustomerId, setPickedCustomerId] = useState<number | ''>('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const load = useCallback(async () => {
    if (!privyUserId) {
      setLoading(false);
      setInvitations([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      if (status && status !== 'all') params.set('status', status);
      const res = await fetch(`/api/customers/invites?${params}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'CUSTOMER_INVITES_DISABLED') {
          toast.message('Customer invites are disabled', {
            description: 'Set CUSTOMER_INVITES_ENABLED=true to enable.',
          });
        } else {
          toast.error(data.error || 'Failed to load invitations');
        }
        setInvitations([]);
        return;
      }
      setInvitations(data.invitations || []);
    } catch {
      toast.error('Failed to load invitations');
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadCustomersForInvite = async () => {
    setLoadingCustomers(true);
    try {
      const res = await fetch(`/api/customers?companyId=${companyId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          (data as { error?: string }).error || 'Failed to load customers for invite'
        );
        return;
      }
      const list = ((data as { customers?: CustomerRecord[] }).customers ||
        []) as CustomerRecord[];
      // Prefer offline / not-yet-connected rows
      setCustomers(
        list.filter(
          (c) =>
            !c.linked_profile_id &&
            c.invite_status !== 'accepted' &&
            c.invite_status !== 'suspended'
        )
      );
    } catch {
      toast.error('Failed to load customers for invite');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const openInvitePicker = () => {
    setShowInvitePicker(true);
    setPickedCustomerId('');
    void loadCustomersForInvite();
  };

  const resend = async (inv: CustomerInvitationRecord) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setActionId(inv.id);
    try {
      const res = await fetch('/api/customers/invites/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          invitationId: inv.id,
          customerId: inv.customer_id,
          privyUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resend failed');
      if (data.warning) {
        toast.message('Invitation resent', { description: data.warning });
      } else {
        toast.success(data.message || 'Invitation resent');
      }
      if (data.inviteLink) {
        try {
          await navigator.clipboard.writeText(data.inviteLink);
          toast.message('Invite link copied to clipboard');
        } catch {
          /* ignore */
        }
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Resend failed');
    } finally {
      setActionId(null);
    }
  };

  const revoke = async (inv: CustomerInvitationRecord) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    if (!confirm(`Revoke invitation to ${inv.email}?`)) return;
    setActionId(inv.id);
    try {
      const res = await fetch('/api/customers/invites/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          invitationId: inv.id,
          privyUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Revoke failed');
      toast.success(data.message || 'Invitation revoked');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const statusLabel = (s?: string | null) =>
    CUSTOMER_INVITATION_STATUSES.find((x) => x.value === s)?.label || s || '—';

  const picked = customers.find((c) => c.id === pickedCustomerId);

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersHeader
        title="Customer invitations"
        description="Invite CRM customers onto the platform. Offline accounts remain fully editable without an invite."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openInvitePicker}
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-1.5"
            >
              <Mail className="w-4 h-4" /> Invite customer
            </button>
            <Link
              href="/dashboard/customers/onboard"
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" /> Add customer
            </Link>
          </div>
        }
      />

      {showInvitePicker && (
        <div className="mb-6 bg-white border rounded-3xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Invite from CRM</h2>
              <p className="text-sm text-neutral-600 mt-0.5">
                Choose an existing offline customer, then send a platform invite.
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-neutral-500 hover:text-neutral-800"
              onClick={() => setShowInvitePicker(false)}
            >
              Close
            </button>
          </div>
          {loadingCustomers ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#00b4d8]" />
          ) : customers.length === 0 ? (
            <p className="text-sm text-neutral-600">
              No invitable customers.{' '}
              <Link href="/dashboard/customers/onboard" className="text-[#00b4d8] font-medium">
                Onboard one first
              </Link>
              .
            </p>
          ) : (
            <>
              <select
                className="input w-full max-w-md !py-2.5 !px-3 !text-sm"
                value={pickedCustomerId === '' ? '' : String(pickedCustomerId)}
                onChange={(e) =>
                  setPickedCustomerId(e.target.value ? Number(e.target.value) : '')
                }
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trading_name}
                    {c.email ? ` · ${c.email}` : ''}
                  </option>
                ))}
              </select>
              {picked && (
                <InviteCustomerButton
                  key={picked.id}
                  customerId={picked.id}
                  customerName={picked.trading_name}
                  defaultEmail={picked.email || picked.invited_email || ''}
                  defaultContactName={picked.contact_name || ''}
                  defaultOpen
                  variant="primary"
                  resend={
                    picked.invite_status === 'invited' ||
                    picked.invite_status === 'declined' ||
                    picked.invite_status === 'expired'
                  }
                  onCancel={() => setPickedCustomerId('')}
                  onSent={() => {
                    setShowInvitePicker(false);
                    setStatus('pending');
                    void load();
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              status === f.value
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 px-2 py-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {!privyUserId && (
        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sign in to load and manage customer invitations for this company.
        </div>
      )}

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="p-16 text-center text-neutral-500">
            <Clock className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            <p className="mb-2 font-medium text-neutral-700">No invitations in this filter</p>
            <p className="text-sm mb-4 max-w-md mx-auto">
              Create a customer profile first, then invite them to the platform. Commercial data
              stays on your company CRM either way.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={openInvitePicker}
                className="btn-primary !py-2.5 !px-5 text-sm"
              >
                Invite customer
              </button>
              <Link
                href="/dashboard/customers/profiles"
                className="btn-secondary !py-2.5 !px-5 text-sm"
              >
                View profiles
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Email</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Sent</th>
                  <th className="px-3 py-3 font-semibold">Expires</th>
                  <th className="px-3 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invitations.map((inv) => {
                  const busy = actionId === inv.id;
                  const canResend =
                    inv.status === 'pending' ||
                    inv.status === 'expired' ||
                    inv.status === 'declined' ||
                    inv.status === 'revoked';
                  const canRevoke = inv.status === 'pending' || inv.status === 'expired';
                  return (
                    <tr key={inv.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold">
                          {inv.customer_name || inv.full_name || `Customer #${inv.customer_id}`}
                        </div>
                        {inv.full_name && inv.customer_name && (
                          <div className="text-xs text-neutral-500">{inv.full_name}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-neutral-700">{inv.email}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${invitationAttemptStatusClass(inv.status)}`}
                        >
                          {statusLabel(inv.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-neutral-600">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="px-3 py-3 text-xs text-neutral-600">
                        {formatDate(inv.expires_at)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canResend && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void resend(inv)}
                              className="p-2 inline-flex rounded-xl hover:bg-neutral-100 text-neutral-600 disabled:opacity-50"
                              title="Resend invite"
                            >
                              {busy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {canRevoke && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void revoke(inv)}
                              className="p-2 inline-flex rounded-xl hover:bg-red-50 text-red-600 disabled:opacity-50"
                              title="Revoke invite"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          <Link
                            href={`/dashboard/customers/onboard?id=${inv.customer_id}`}
                            className="p-2 inline-flex rounded-xl hover:bg-neutral-100 text-neutral-600 text-xs font-medium px-2"
                            title="Edit customer"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
