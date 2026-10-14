'use client';

import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { ThemeToggleView } from '@/components/theme/ThemeToggleView';

type Props = {
  /** compact = icon popover; segmented = appearance only; full = both sections */
  variant?: 'icon' | 'segmented' | 'menu' | 'full';
  className?: string;
};

/**
 * Signed-in theme picker. Company role comes from Privy, so do not mount
 * this on /login — that page uses ThemeToggleView directly.
 */
export default function ThemeToggle({
  variant = 'icon',
  className = '',
}: Props) {
  const { enabledModules, packaging } = useCompanyRole();
  return (
    <ThemeToggleView
      variant={variant}
      className={className}
      enabledModules={enabledModules}
      packaging={packaging}
    />
  );
}
