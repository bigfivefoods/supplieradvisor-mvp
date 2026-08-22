'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
import { videoEmbedSrc } from '@/lib/fitness/movements';

type Props = {
  companyId?: number;
  uploadFile?: (file: File) => Promise<string>;
  imageUrl: string;
  videoUrl: string;
  videoDescription: string;
  onChange: (patch: {
    image_url?: string;
    video_url?: string;
    video_description?: string;
  }) => void;
  dark?: boolean;
  /** Hide the coaching-cues textarea (class shop marketing only needs the clip). */
  showVideoDescription?: boolean;
};

export function MovementMediaFields({
  companyId,
  uploadFile,
  imageUrl,
  videoUrl,
  videoDescription,
  onChange,
  dark,
  showVideoDescription = true,
}: Props) {
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'image' | 'video' | null>(null);
  const embed = videoEmbedSrc(videoUrl);

  const put = async (file: File, kind: 'image' | 'video') => {
    setBusy(kind);
    try {
      let url = '';
      if (uploadFile) {
        url = await uploadFile(file);
      } else if (companyId) {
        const result = await uploadCompanyAssetServerFirst({
          file,
          companyId,
          kind: kind === 'image' ? 'movement_image' : 'movement_video',
          profileField: null,
        });
        if (!result.url) throw new Error(result.error || 'Upload failed');
        url = result.url;
      } else {
        throw new Error('No upload path');
      }
      if (kind === 'image') onChange({ image_url: url });
      else onChange({ video_url: url });
      toast.success(kind === 'image' ? 'Image added' : 'Video uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
      if (imgRef.current) imgRef.current.value = '';
      if (vidRef.current) vidRef.current.value = '';
    }
  };

  const box = dark
    ? 'rounded-xl border border-slate-700 bg-slate-950/60 p-3 space-y-2'
    : 'rounded-xl border border-slate-200 bg-white p-3 space-y-2 dark:border-yellow-800 dark:bg-yellow-950/30';
  const input = dark
    ? 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm'
    : 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-yellow-700 dark:bg-yellow-950';
  const btn = dark
    ? 'inline-flex items-center gap-1 rounded-xl border border-slate-600 px-2.5 py-1.5 text-[11px] font-bold'
    : 'inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold dark:border-yellow-700';

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2 lg:col-span-3">
      <div className={box}>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Image
        </p>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-28 w-full rounded-lg object-cover"
          />
        ) : (
          <div className="h-28 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 dark:border-slate-600">
            <ImagePlus className="w-6 h-6" />
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={btn}
            disabled={busy !== null}
            onClick={() => imgRef.current?.click()}
          >
            {busy === 'image' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImagePlus className="w-3.5 h-3.5" />
            )}
            {imageUrl ? 'Change image' : 'Upload image'}
          </button>
          {imageUrl ? (
            <button
              type="button"
              className={btn}
              onClick={() => onChange({ image_url: '' })}
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          ) : null}
        </div>
        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void put(f, 'image');
          }}
        />
      </div>
      <div className={box}>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Video
        </p>
        {embed ? (
          embed.iframe ? (
            <iframe
              title="Movement video"
              src={embed.src}
              className="h-28 w-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={embed.src}
              className="h-28 w-full rounded-lg bg-black object-contain"
              controls
            />
          )
        ) : (
          <div className="h-28 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 dark:border-slate-600">
            <Video className="w-6 h-6" />
          </div>
        )}
        <input
          className={input}
          placeholder="YouTube / Vimeo / MP4 URL"
          value={videoUrl}
          onChange={(e) => onChange({ video_url: e.target.value })}
        />
        {showVideoDescription ? (
          <textarea
            className={input + ' min-h-[3.5rem] resize-y'}
            placeholder="Video description — what to watch for, cues, common faults"
            value={videoDescription}
            onChange={(e) => onChange({ video_description: e.target.value })}
          />
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={btn}
            disabled={busy !== null}
            onClick={() => vidRef.current?.click()}
          >
            {busy === 'video' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Video className="w-3.5 h-3.5" />
            )}
            Upload short clip
          </button>
          {videoUrl ? (
            <button
              type="button"
              className={btn}
              onClick={() => onChange({ video_url: '', video_description: '' })}
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear video
            </button>
          ) : null}
        </div>
        <p className="text-[10px] text-slate-500">
          Prefer a YouTube / Vimeo link for longer demos. Uploaded clips max
          40MB.
        </p>
        <input
          ref={vidRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void put(f, 'video');
          }}
        />
      </div>
    </div>
  );
}
