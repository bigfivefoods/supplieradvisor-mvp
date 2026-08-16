'use client';

import {
  CATEGORY_COLORS,
  figurePaths,
  movementArtSeed,
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
  const url = String(imageUrl || '').trim();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`w-full object-cover bg-slate-100 ${
          large ? 'h-52' : 'h-28'
        } ${className}`}
      />
    );
  }
  const cat = category || 'Other';
  const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
  const pose = resolveMovementPose(name, cat);
  const seed = movementArtSeed(code || name);
  const d = figurePaths(pose, seed);
  const h = large ? 208 : 112;
  return (
    <svg
      viewBox="0 0 320 160"
      className={`w-full ${className}`}
      style={{ height: h }}
      role="img"
      aria-label={`${name} instructional plate`}
    >
      <rect width="320" height="160" rx="0" fill={colors.bg} />
      <rect x="0" y="0" width="8" height="160" fill={colors.accent} />
      <text
        x="20"
        y="22"
        fill={colors.ink}
        fontSize="10"
        fontWeight="800"
        letterSpacing="1.2"
        opacity="0.55"
      >
        {(cat || 'MOVEMENT').toUpperCase()}
      </text>
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
      <text
        x="20"
        y="132"
        fill={colors.ink}
        fontSize={large ? 16 : 14}
        fontWeight="800"
      >
        {name.length > 34 ? `${name.slice(0, 32)}…` : name}
      </text>
      <text x="20" y="150" fill={colors.ink} fontSize="10" opacity="0.7">
        {(muscles || equipment || 'Bodyweight').slice(0, 48)}
      </text>
    </svg>
  );
}
