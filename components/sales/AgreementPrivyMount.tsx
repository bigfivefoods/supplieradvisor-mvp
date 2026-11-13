'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Providers } from '@/components/Providers';
import EnablePushButton from '@/components/pwa/EnablePushButton';
import SamMessenger from '@/components/sam/SamMessenger';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import type { AgreementChromeSnap } from '@/components/sales/agreement-session';
import { consumeAgreementSam, hasAgreementSam } from '@/components/sales/agreement-pending';
import { useSalesShellSession } from '@/components/sales/useSalesShellSession';

export type AgreementPrivyReport = AgreementChromeSnap & {
  logout: () => void;
};

/**
 * Same PrivyProvider the rest of sales uses. Mounted beside the agreement
 * document, not around it, so the heading stays on screen while the SDK loads.
 * ApiAuthBridge still patches fetch before the page asks for the agreement.
 */
export function AgreementPrivyMount({
  onReport,
  pushHost,
}: {
  onReport: (report: AgreementPrivyReport) => void;
  pushHost: HTMLElement | null;
}) {
  return (
    <Providers>
      <AgreementPrivyReporter onReport={onReport} />
      <AgreementPrivyExtras pushHost={pushHost} />
    </Providers>
  );
}

function AgreementPrivyExtras({ pushHost }: { pushHost: HTMLElement | null }) {
  useEffect(() => {
    if (!hasAgreementSam()) return;
    const id = window.setTimeout(() => {
      if (!consumeAgreementSam()) return;
      window.dispatchEvent(new Event('sa:open-sam'));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <>
      {pushHost ? createPortal(<EnablePushButton compact />, pushHost) : null}
      <SamMessenger />
    </>
  );
}

function AgreementPrivyReporter({
  onReport,
}: {
  onReport: (report: AgreementPrivyReport) => void;
}) {
  const session = useSalesShellSession();
  const { role, loading } = useCompanyRole();

  useEffect(() => {
    onReport({
      ready: session.ready,
      authenticated: session.authenticated,
      privyUserId: session.privyUserId,
      email: session.email,
      companyName: session.companyName,
      needAgreement: session.needAgreement,
      needSubscription: session.needSubscription,
      role: role ? String(role) : null,
      roleLoading: loading,
      logout: () => {
        void session.logout();
      },
    });
  }, [
    session.ready,
    session.authenticated,
    session.privyUserId,
    session.email,
    session.companyName,
    session.needAgreement,
    session.needSubscription,
    session.logout,
    role,
    loading,
    onReport,
  ]);

  return null;
}
