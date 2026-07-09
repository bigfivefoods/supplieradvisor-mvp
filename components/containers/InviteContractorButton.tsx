'use client';

import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';

type Props = {
  containerId: number;
  containerName?: string;
  defaultEmail?: string;
  defaultName?: string;
  contractorId?: number | null;
  onSent?: () => void;
  className?: string;
};

export default function InviteContractorButton({
  containerId,
  containerName,
  defaultEmail = '',
  defaultName = '',
  contractorId,
  onSent,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [fullName, setFullName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [lastLink, setLastLink] = useState('');

  const send = async () => {
    const companyId = getSelectedCompanyId();
    if (!companyId || !email) {
      toast.error('Company and email required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/containers/contractor-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          containerId,
          email,
          full_name: fullName || undefined,
          contractor_id: contractorId || undefined,
          companyName: getSelectedCompanyName(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Invite failed');
      toast.success(data.warning || 'Invitation emailed');
      if (data.inviteLink) setLastLink(data.inviteLink);
      onSent?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#00b4d8] hover:underline ${className}`}
      >
        <Mail className="w-4 h-4" /> Invite to operate
      </button>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-2xl border border-[#00b4d8]/30 bg-[#00b4d8]/5 space-y-3">
      <div className="text-sm font-semibold text-slate-900">
        Invite contractor{containerName ? ` · ${containerName}` : ''}
      </div>
      <p className="text-xs text-neutral-600">
        They will receive an email, accept the Independent Contractor Agreement, then only see this
        container in their operator portal.
      </p>
      <input
        className="input w-full !p-2.5 !text-sm"
        placeholder="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <input
        className="input w-full !p-2.5 !text-sm"
        type="email"
        placeholder="Email *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 !py-2 text-sm">
          Cancel
        </button>
        <button type="button" disabled={loading} onClick={() => void send()} className="btn-primary flex-1 !py-2 text-sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send invite'}
        </button>
      </div>
      {lastLink && (
        <p className="text-xs text-neutral-500 break-all">
          Link (if email fails): {lastLink}
        </p>
      )}
    </div>
  );
}
