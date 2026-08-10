'use client';

/**
 * Shared profile photo upload for coaches, practitioners, staff, clients & patients.
 * Uses company asset upload (server-first) and returns a public URL via onChange.
 */
import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';

type Props = {
  companyId: number;
  value?: string | null;
  onChange: (url: string) => void;
  /** Storage kind label — e.g. coach_photo, client_photo */
  kind?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /** Tailwind ring / accent for the avatar frame */
  accentClass?: string;
};

export function ProfilePhotoField({
  companyId,
  value,
  onChange,
  kind = 'profile_photo',
  label = 'Profile photo',
  description = 'JPG, PNG or WebP · under 8MB',
  disabled,
  className = '',
  accentClass = 'border-slate-200 dark:border-neutral-600',
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const url = String(value || '').trim();

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Photo must be under 8MB');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind,
        profileField: null,
      });
      if (!result.url) {
        toast.error(result.error || 'Upload failed');
        return;
      }
      onChange(result.url);
      toast.success('Photo uploaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div
      className={`sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900/40 ${className}`}
    >
      <div
        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 bg-white dark:bg-neutral-950 ${accentClass}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-500">
            <UserRound className="h-7 w-7" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-neutral-300">
          {label}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
          {description}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-violet-600 dark:hover:bg-violet-500"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {uploading ? 'Uploading…' : url ? 'Change photo' : 'Upload photo'}
          </button>
          {url ? (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </div>
  );
}
