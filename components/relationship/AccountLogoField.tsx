'use client';

import { useRef, useState } from 'react';
import { Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import CompanyLogo from '@/components/business/CompanyLogo';

type Size = 'sm' | 'md' | 'lg';

/**
 * Upload / show a CRM customer or SRM supplier logo.
 * Stores the file in company storage, then PATCHes the book row.
 */
export function AccountLogoField({
  companyId,
  privyUserId,
  kind,
  recordId,
  logoUrl,
  name,
  size = 'lg',
  compact,
  variant = 'company',
  onChange,
}: {
  companyId: number;
  privyUserId?: string | null;
  kind: 'customer' | 'supplier';
  recordId?: number | null;
  logoUrl?: string | null;
  name?: string | null;
  size?: Size;
  compact?: boolean;
  variant?: 'company' | 'person';
  onChange?: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const persist = async (url: string | null) => {
    onChange?.(url);
    if (!recordId || recordId <= 0) return;
    const path = kind === 'customer' ? '/api/customers' : '/api/suppliers';
    const res = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        id: recordId,
        companyId,
        privyUserId: privyUserId || undefined,
        logo_url: url,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not save logo');
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('companyId', String(companyId));
      if (privyUserId) fd.append('privyUserId', privyUserId);
      fd.append('kind', kind === 'customer' ? 'customer_logo' : 'supplier_logo');
      const up = await fetch('/api/business/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await up.json().catch(() => ({}));
      if (!up.ok || !data.url) {
        throw new Error(data.error || 'Upload failed');
      }
      await persist(String(data.url));
      toast.success('Logo saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await persist(null);
      toast.success('Logo removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove logo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="relative shrink-0"
        title="Upload logo"
      >
        <CompanyLogo logoUrl={logoUrl} name={name} size={size} variant={variant} />
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
            <Loader2 className="h-4 w-4 animate-spin text-[#0077b6]" />
          </span>
        ) : (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0077b6] shadow-sm">
            <ImagePlus className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {compact ? null : (
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-800">Logo</p>
        <p className="text-[11px] text-neutral-500">
          PNG, JPG or WebP. Shown on 360 and their portal.
        </p>
        {logoUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clear()}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-rose-700"
          >
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        ) : null}
      </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] || null)}
      />
    </div>
  );
}
