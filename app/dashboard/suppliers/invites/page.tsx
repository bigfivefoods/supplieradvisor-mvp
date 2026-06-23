'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Copy, RefreshCw, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface InvitedSupplier {
  id: string;
  trading_name: string;
  email: string;
  contact_name: string | null;
  supplier_status: string;
  invited_at: string | null;
  claimed_at: string | null;
  invited_by: string | null;
  invite_token: string | null;
}

export default function SentInvitationsPage() {
  const [invites, setInvites] = useState<InvitedSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, trading_name, email, contact_name, supplier_status, invited_at, claimed_at, invited_by, invite_token')
      .eq('relationship_type', 'supplier')
      .in('supplier_status', ['invited', 'active'])
      .order('invited_at', { ascending: false });

    if (error) {
      toast.error('Failed to load invitations');
      console.error(error);
    } else {
      setInvites(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const copyInviteLink = (token: string | null) => {
    if (!token) return;
    const link = `https://supplieradvisor-mvp.vercel.app/onboarding?invite=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied to clipboard');
  };

  const resendInvite = async (invite: InvitedSupplier) => {
    // For now just copy the link again. We can add real resend later.
    if (invite.invite_token) {
      copyInviteLink(invite.invite_token);
      toast.success(`Resend link copied for ${invite.trading_name}`);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <span className="px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Active</span>;
    }
    return <span className="px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Invited</span>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Sent Invitations</h1>
          <p className="text-neutral-600 mt-2">Track all supplier invitations you've sent</p>
        </div>
        <button 
          onClick={fetchInvites} 
          className="flex items-center gap-2 px-5 py-2.5 border rounded-2xl hover:bg-neutral-50"
        >
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00b4d8]"></div>
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border">
          <Clock className="mx-auto mb-4 text-neutral-400" size={48} />
          <p className="text-xl text-neutral-600">No invitations sent yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-8 py-5 font-semibold text-sm">Supplier</th>
                <th className="text-left px-6 py-5 font-semibold text-sm">Contact</th>
                <th className="text-left px-6 py-5 font-semibold text-sm">Invited By</th>
                <th className="text-left px-6 py-5 font-semibold text-sm">Invited At</th>
                <th className="text-left px-6 py-5 font-semibold text-sm">Status</th>
                <th className="text-right px-8 py-5 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invites.map((invite) => (
                <tr key={invite.id} className="hover:bg-neutral-50 transition">
                  <td className="px-8 py-6">
                    <div className="font-semibold text-lg">{invite.trading_name}</div>
                  </td>
                  <td className="px-6 py-6">
                    <div>{invite.contact_name || '—'}</div>
                    <div className="text-sm text-neutral-500">{invite.email}</div>
                  </td>
                  <td className="px-6 py-6 text-sm text-neutral-600">
                    {invite.invited_by || '—'}
                  </td>
                  <td className="px-6 py-6 text-sm text-neutral-600">
                    {formatDate(invite.invited_at)}
                  </td>
                  <td className="px-6 py-6">
                    {getStatusBadge(invite.supplier_status)}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => copyInviteLink(invite.invite_token)}
                        className="p-2.5 hover:bg-neutral-100 rounded-xl transition"
                        title="Copy invite link"
                      >
                        <Copy size={18} />
                      </button>
                      <button
                        onClick={() => resendInvite(invite)}
                        className="p-2.5 hover:bg-neutral-100 rounded-xl transition"
                        title="Resend invite"
                      >
                        <RefreshCw size={18} />
                      </button>
                      <a
                        href={`/dashboard/suppliers/${invite.id}`}
                        className="p-2.5 hover:bg-neutral-100 rounded-xl transition"
                        title="View profile"
                      >
                        <Eye size={18} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}