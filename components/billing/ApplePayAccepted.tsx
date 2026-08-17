'use client';

/**
 * Official Apple Pay wordmark for “we accept Apple Pay” (not a pay button).
 * Artwork is Apple’s public payment mark (currentColor so it can invert).
 */

export function ApplePayMark({
  variant = 'black',
  size = 'md',
}: {
  variant?: 'black' | 'white';
  size?: 'sm' | 'md';
}) {
  const box =
    size === 'sm'
      ? 'h-7 px-2 rounded-[7px]'
      : 'h-9 px-2.5 rounded-[8px]';
  const logo = size === 'sm' ? 'h-[13px] w-[32px]' : 'h-[16px] w-[40px]';
  const dark = variant === 'black';
  return (
    <span
      className={`inline-flex items-center justify-center ${box} ${
        dark
          ? 'bg-black text-white'
          : 'border border-black/80 bg-white text-black'
      }`}
      title="Apple Pay"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/apple-pay-logo.svg"
        alt="Apple Pay"
        className={`${logo} object-contain ${dark ? 'brightness-0 invert' : ''}`}
      />
    </span>
  );
}

function CardGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 26"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect x="0.6" y="0.6" width="38.8" height="24.8" rx="3.4" fill="currentColor" />
      <rect x="0.6" y="6" width="38.8" height="4.2" fill="#111" opacity="0.35" />
      <rect x="4" y="16.5" width="10" height="3" rx="1" fill="#fff" opacity="0.85" />
      <circle cx="28.5" cy="18" r="2.4" fill="#f59e0b" opacity="0.95" />
      <circle cx="32.2" cy="18" r="2.4" fill="#ef4444" opacity="0.9" />
    </svg>
  );
}

export function AdvisorPayAccepted({
  tone = 'onLight',
  size = 'md',
  label,
}: {
  tone?: 'onLight' | 'onBrandLight' | 'onBrandDark';
  size?: 'sm' | 'md';
  label?: string;
}) {
  const mark = tone === 'onBrandDark' ? 'white' : 'black';
  const copy =
    label ?? (size === 'sm' ? 'Cards accepted' : 'Cards & Apple Pay accepted');
  const wrap =
    tone === 'onLight'
      ? 'bg-white text-slate-700 ring-1 ring-slate-200/90 shadow-sm'
      : tone === 'onBrandLight'
        ? 'bg-white/80 text-slate-800 ring-1 ring-black/10'
        : 'bg-white/12 text-white ring-1 ring-white/25';
  const pad = size === 'sm' ? 'px-2 py-1 gap-1.5' : 'px-2.5 py-1.5 gap-2';
  const type =
    size === 'sm'
      ? 'text-[10px] font-bold tracking-wide'
      : 'text-[11px] font-bold tracking-wide';
  return (
    <span
      className={`inline-flex items-center rounded-2xl ${pad} ${wrap}`}
      title="Card and Apple Pay accepted"
    >
      <ApplePayMark variant={mark} size={size} />
      <span className="flex items-center" aria-hidden>
        <CardGlyph
          className={`${size === 'sm' ? 'h-5 w-[30px]' : 'h-6 w-[36px]'} text-slate-800`}
        />
      </span>
      <span className={`${type} leading-none`}>{copy}</span>
    </span>
  );
}
