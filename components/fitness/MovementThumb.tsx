'use client';

import {
  CATEGORY_COLORS,
  figurePaths,
  movementArtSeed,
  movementPoseImageSrc,
  resolveMovementPose,
} from '@/lib/fitness/movement-art';

export function MovementThumb({
  name,
  category,
  code,
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
  const photo = custom || movementPoseImageSrc(pose);
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
          if (el.dataset.fallback === '1') return;
          el.dataset.fallback = '1';
          el.style.display = 'none';
        }}
      />
      <StickFallback name={name} category={cat} code={code} />
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

function StickFallback({
  name,
  category,
  code,
}: {
  name: string;
  category: string;
  code?: string | null;
}) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
  const pose = resolveMovementPose(name, category);
  const d = figurePaths(pose, movementArtSeed(code || name));
  return (
    <svg
      viewBox="0 0 320 160"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <rect width="320" height="160" fill={colors.bg} />
      <g
        transform="translate(150,18) scale(1.05)"
        fill="none"
        stroke={colors.ink}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </g>
    </svg>
  );
}
