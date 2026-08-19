'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  PORTAL_PHOTO_SAVED_MESSAGE,
  PORTAL_PHOTO_SHARE_HINT,
} from '@/lib/services/portal-profile';

export function B2cPhotoField({
  value,
  onChange,
  initials,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  initials?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const url = String(value || '').trim();

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a JPG, PNG or WebP image');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Photo must be under 8MB');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/b2c/photo', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Upload failed');
      }
      onChange(String(data.url));
      toast.success(
        typeof data.message === 'string' && data.message
          ? data.message
          : PORTAL_PHOTO_SAVED_MESSAGE
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-sky-400 to-[#0077b6] text-xl font-black text-white ring-2 ring-white/40 dark:ring-white/10"
        aria-label={url ? 'Change profile photo' : 'Upload profile photo'}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{(initials || 'U').slice(0, 1).toUpperCase()}</span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/45 py-0.5">
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin text-white" />
          ) : (
            <Camera className="h-3 w-3 text-white" />
          )}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-slate-900 dark:text-white">
          Profile photo
        </p>
        <p className="text-[11px] text-slate-500 dark:text-neutral-400">
          {PORTAL_PHOTO_SHARE_HINT}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 dark:bg-sky-600"
          >
            {uploading ? 'Uploading…' : url ? 'Change photo' : 'Upload photo'}
          </button>
          {url ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 dark:border-rose-500/40 dark:text-rose-300"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </div>
  );
}
