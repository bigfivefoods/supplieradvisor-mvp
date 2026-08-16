'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';

export function MovementImageReplace({
  companyId,
  uploadFile,
  hasCustomImage,
  onReplace,
  dark,
}: {
  companyId?: number;
  uploadFile?: (file: File) => Promise<string>;
  hasCustomImage: boolean;
  onReplace: (url: string | null) => Promise<void> | void;
  dark?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const btn = dark
    ? 'inline-flex items-center gap-1 rounded-xl border border-slate-600 px-2.5 py-1.5 text-[11px] font-bold'
    : 'inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold dark:border-yellow-700';

  const put = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Choose a JPG, PNG or WebP image');
      return;
    }
    setBusy(true);
    try {
      let url = '';
      if (uploadFile) {
        url = await uploadFile(file);
      } else if (companyId) {
        const result = await uploadCompanyAssetServerFirst({
          file,
          companyId,
          kind: 'movement_image',
          profileField: null,
        });
        if (!result.url) throw new Error(result.error || 'Upload failed');
        url = result.url;
      } else {
        throw new Error('No upload path');
      }
      await onReplace(url);
      toast.success('Image updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        className={btn}
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ImagePlus className="w-3.5 h-3.5" />
        )}
        {hasCustomImage ? 'Replace image' : 'Upload photo'}
      </button>
      {hasCustomImage ? (
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() => void onReplace(null)}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Use catalog image
        </button>
      ) : null}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void put(f);
        }}
      />
    </div>
  );
}
