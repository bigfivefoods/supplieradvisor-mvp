'use client';

import {
  movementPoseImageSrc,
  resolveMovementPose,
} from '@/lib/fitness/movement-art';

export function MovementThumb({
  name,
  category,
  imageUrl,
  muscles,
  equipment,
  className = '',
  large,
}: {
  name: string;
  category?: string | null;
  code?: string | null;
  imageUrl?: string | null;
  muscles?: string | null;
  equipment?: string | null;
  className?: string;
  large?: boolean;
}) {
  const custom = String(imageUrl || '').trim();
  const cat = category || 'Other';
  const pose = resolveMovementPose(name, cat);
  const poseSrc = movementPoseImageSrc(pose);
  const genericSrc = movementPoseImageSrc('generic');
  const photo = custom || poseSrc;
  const h = large ? 'h-64' : 'h-40';
  const caption = (muscles || equipment || 'Bodyweight').slice(0, 48);

  return (
    <div className={`relative overflow-hidden bg-slate-900 ${h} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt={name}
        className="absolute inset-0 h-full w-full object-cover object-center"
        onError={(e) => {
          const el = e.currentTarget;
          if (el.dataset.fallback === 'generic') return;
          if (el.dataset.fallback === 'pose' || photo === poseSrc) {
            el.dataset.fallback = 'generic';
            el.src = genericSrc;
            return;
          }
          el.dataset.fallback = 'pose';
          el.src = poseSrc;
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
      {large ? (
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/70">
            {cat}
          </p>
          <p className="text-base font-black leading-tight">
            {name.length > 34 ? `${name.slice(0, 32)}…` : name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-white/75">{caption}</p>
        </div>
      ) : null}
    </div>
  );
}
