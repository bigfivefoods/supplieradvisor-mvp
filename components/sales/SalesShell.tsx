'use client';

import { Loader2 } from 'lucide-react';
import EnablePushButton from '@/components/pwa/EnablePushButton';
import { SalesShellFrame } from '@/components/sales/SalesShellFrame';
import { useSalesShellSession } from '@/components/sales/useSalesShellSession';

export default function SalesShell({ children }: { children: React.ReactNode }) {
  const session = useSalesShellSession();

  // Privy resolves after the first paint. Keep the shell (and the agreement
  // heading) on screen instead of swapping a full-page spinner. Logged-out
  // visitors are sent to /login once Privy is ready. The agreement page stays
  // put during that redirect so the heading is not torn down.
  if (session.ready && !session.authenticated && !session.onAgreement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  return (
    <SalesShellFrame
      email={session.email}
      companyName={session.companyName}
      needAgreement={session.needAgreement}
      needSubscription={session.needSubscription}
      onLogout={() => {
        void session.logout();
      }}
      headerExtras={<EnablePushButton compact />}
    >
      {children}
    </SalesShellFrame>
  );
}
