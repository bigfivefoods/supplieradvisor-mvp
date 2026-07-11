'use client';

import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Soft role gate for buttons / panels — never a hard wall unless `block`.
 */
export function RoleDeniedBanner({
  message,
  className = '',
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
      role="status"
    >
      <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" aria-hidden />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

export function RoleAwareButton({
  allowed,
  deniedHint,
  children,
  className = '',
  disabled,
  type = 'button',
  onClick,
  title,
}: {
  allowed: boolean;
  deniedHint?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  title?: string;
}) {
  const blocked = !allowed || disabled;
  return (
    <button
      type={type}
      disabled={blocked}
      title={!allowed ? deniedHint || title : title}
      onClick={onClick}
      className={`${className} ${
        !allowed ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {children}
    </button>
  );
}
