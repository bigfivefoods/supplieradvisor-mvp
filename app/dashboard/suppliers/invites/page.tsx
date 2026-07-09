'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Ban } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { inviteStatusClass, type SupplierInvitation } from '@/lib/suppliers/types';
import { CompanyRequired, SuppliersHeader } from '@/components/suppliers/SuppliersShell';

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
  const [rows, setRows] = useState<SupplierInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/suppliers/invites?companyId=${companyId}&privyUserId=${encodeURIComponent(user?.id || '')}`
      );
      const data = await res.json();
      setRows(data.invitations || []);
      if (data.warning) toast.message(data.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: number, action: 'resend' | 'revoke') => {
    setBusy(id);
    try {
      const res = await fetch('/api/suppliers/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId: user?.id,
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
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <SuppliersHeader
        title="Supplier invitations"
        description="Pending and historical invites. Suppliers claim via secure link, activate their company, and take ownership — your book entry links automatically."
      />

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center text-sm text-neutral-500">No invitations yet.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((inv) => (
              <li
                key={inv.id}
                className="px-5 py-4 flex flex-wrap gap-3 justify-between items-center text-sm"
              >
                <div>
                  <div className="font-semibold">{inv.company_name || inv.email}</div>
                  <div className="text-xs text-neutral-500">
                    {inv.email}
                    {inv.full_name ? ` · ${inv.full_name}` : ''}
                    {inv.expires_at
                      ? ` · expires ${new Date(inv.expires_at).toLocaleDateString()}`
                      : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${inviteStatusClass(inv.status)}`}
                  >
                    {inv.status}
                  </span>
                  {inv.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={busy === inv.id}
                        onClick={() => void act(inv.id, 'resend')}
                        className="btn-secondary !py-1.5 !px-3 text-xs"
                      >
                        <RefreshCw className="w-3 h-3" /> Resend
                      </button>
                      <button
                        type="button"
                        disabled={busy === inv.id}
                        onClick={() => void act(inv.id, 'revoke')}
                        className="text-xs text-red-600 inline-flex items-center gap-1 px-2"
                      >
                        <Ban className="w-3 h-3" /> Revoke
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
