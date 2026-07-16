'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  canInviteCustomer,
  customerInviteActionLabel,
  customerInviteStatusClass,
  customerInviteStatusLabel,
  resolveCustomerConnectionPhase,
  type CustomerRecord,
} from '@/lib/customers/types';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';
import InviteCustomerButton from '@/components/customers/InviteCustomerButton';
import CompanyLogo from '@/components/business/CompanyLogo';

export default function CustomerProfilesPage() {
  return (
    <CompanyRequired>
      <ProfilesInner />
    </CompanyRequired>
  );
}

function ProfilesInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [inviteOpenId, setInviteOpenId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (q) params.set('q', q);
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } finally {
      setLoading(false);
    }
  }, [companyId, q, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (id: number) => {
    if (!confirm('Delete this customer?')) return;
    const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      void load();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Failed');
    }
  };

  const setSuspended = async (c: CustomerRecord, suspend: boolean) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    const label = suspend ? 'Suspend' : 'Unsuspend';
    if (
      !confirm(
        suspend
          ? `Suspend platform collaboration with ${c.trading_name}? They keep historical access; new POs and shares are blocked.`
          : `Restore platform collaboration with ${c.trading_name}?`
      )
    ) {
      return;
    }
    setActionId(c.id);
    try {
      const res = await fetch(
        suspend ? '/api/customers/invites/suspend' : '/api/customers/invites/unsuspend',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            customerId: c.id,
            privyUserId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${label} failed`);
      toast.success(data.message || (suspend ? 'Suspended' : 'Unsuspended'));
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersHeader
        title="Customer profiles"
        description="Account master data — contacts, commercial terms, and service history anchors. Platform invites are optional; offline customers stay fully editable."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/customers/invites"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              Invites
            </Link>
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-5 text-sm">
              <Plus className="w-4 h-4" /> Add customer
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !pl-9 !py-2.5 !text-sm"
            placeholder="Search name, email, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input !py-2.5 !px-3 !text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="prospect">Prospect</option>
          <option value="on_hold">On hold</option>
        </select>
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-16 text-center text-neutral-500">
            <Users className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            <p className="mb-4">No customers yet. Onboard your first account.</p>
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-5 text-sm">
              Add customer
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Contact</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Location</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Connection</th>
                  <th className="px-3 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* linked company logo when on platform; customer book may not have logo */}
                        <CompanyLogo
                          logoUrl={(c as { logo_url?: string | null }).logo_url}
                          name={c.trading_name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.trading_name}</div>
                          <div className="text-xs text-neutral-500 truncate">
                            {c.legal_name || c.industry || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{c.contact_name || '—'}</div>
                      <div className="text-xs text-neutral-500">
                        {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3 capitalize text-xs">
                      {(c.customer_type || 'business').replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-600">
                      {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                        {c.status || 'active'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${customerInviteStatusClass(c.invite_status, c.linked_profile_id)}`}
                      >
                        {customerInviteStatusLabel(c.invite_status, c.linked_profile_id)}
                      </span>
                      {inviteOpenId === c.id && canInviteCustomer(c) && (
                        <div className="mt-2 min-w-[240px]">
                          <InviteCustomerButton
                            key={c.id}
                            customerId={c.id}
                            customerName={c.trading_name}
                            defaultEmail={c.email || c.invited_email || ''}
                            defaultContactName={c.contact_name || ''}
                            defaultOpen
                            resend={
                              c.invite_status === 'invited' ||
                              c.invite_status === 'declined' ||
                              c.invite_status === 'expired'
                            }
                            onCancel={() => setInviteOpenId(null)}
                            onSent={() => {
                              setInviteOpenId(null);
                              void load();
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        {canInviteCustomer(c) && inviteOpenId !== c.id && (
                          <button
                            type="button"
                            onClick={() => setInviteOpenId(c.id)}
                            className="text-xs font-semibold text-[#00b4d8] hover:underline px-2 py-1"
                          >
                            {customerInviteActionLabel(c)}
                          </button>
                        )}
                        {(() => {
                          const phase = resolveCustomerConnectionPhase(c);
                          const busy = actionId === c.id;
                          if (phase === 'accepted') {
                            return (
                              <button
                                type="button"
                                disabled={busy || !privyUserId}
                                onClick={() => void setSuspended(c, true)}
                                className="p-2 inline-flex rounded-xl hover:bg-amber-50 text-amber-700 disabled:opacity-50"
                                title="Suspend connection"
                              >
                                {busy ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <PauseCircle className="w-4 h-4" />
                                )}
                              </button>
                            );
                          }
                          if (phase === 'suspended') {
                            return (
                              <button
                                type="button"
                                disabled={busy || !privyUserId}
                                onClick={() => void setSuspended(c, false)}
                                className="p-2 inline-flex rounded-xl hover:bg-emerald-50 text-emerald-700 disabled:opacity-50"
                                title="Unsuspend connection"
                              >
                                {busy ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <PlayCircle className="w-4 h-4" />
                                )}
                              </button>
                            );
                          }
                          return null;
                        })()}
                        <Link
                          href={`/dashboard/customers/onboard?id=${c.id}`}
                          className="p-2 inline-flex rounded-xl hover:bg-neutral-100 text-neutral-600"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void remove(c.id)}
                          className="p-2 inline-flex rounded-xl hover:bg-red-50 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
