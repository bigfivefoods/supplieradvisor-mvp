'use client';

import { useState } from 'react';
import { useApiAuth } from '@/lib/client/use-api-auth';
import { toast } from 'sonner';

type Props = {
  companyId: number;
  refOrUrl: string;
  className?: string;
  children?: React.ReactNode;
  newTab?: boolean;
};

export default function SecureDocLink({
  companyId,
  refOrUrl,
  className,
  children,
  newTab = true,
}: Props) {
  const { withAuth } = useApiAuth();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!refOrUrl || busy) return;
    setBusy(true);
    try {
      const q = new URLSearchParams({
        companyId: String(companyId),
        ref: refOrUrl,
        json: '1',
      });
      const res = await withAuth(`/api/storage/doc?${q.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Document unavailable');
      const url = String(data.url);
      if (newTab) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = url;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open document');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void open();
      }}
      className={className}
      disabled={busy}
    >
      {children || (busy ? 'Opening…' : 'Open document')}
    </button>
  );
}
