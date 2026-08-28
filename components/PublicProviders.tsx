'use client';

import { Toaster } from 'sonner';
import SchemaHealthBanner from '@/components/system/SchemaHealthBanner';
import InstallAppBanner from '@/components/pwa/InstallAppBanner';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';
import { ThemeProvider, useTheme } from '@/components/theme/ThemeProvider';

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      expand={false}
      theme={resolved}
    />
  );
}

/** Marketing / public pages — no Privy, wagmi, or viem. */
export function PublicProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ServiceWorkerRegister />
      <SchemaHealthBanner />
      <div className="min-h-dvh pointer-events-auto isolate bg-sa-bg text-sa-text">
        {children}
      </div>
      <InstallAppBanner />
      <ThemedToaster />
    </ThemeProvider>
  );
}
