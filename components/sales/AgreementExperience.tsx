'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clientShouldLoadPrivyImmediately } from '@/lib/auth/login-privy-resume';
import { SalesShellFrame } from '@/components/sales/SalesShellFrame';
import {
  AGREEMENT_CHROME_IDLE,
  AgreementSessionProvider,
  sameAgreementChrome,
  type AgreementChromeSnap,
} from '@/components/sales/agreement-session';
import {
  queueAgreementLogout,
  queueAgreementSam,
} from '@/components/sales/agreement-pending';

type PrivyReport = AgreementChromeSnap & { logout: () => void };
type PrivyMount = React.ComponentType<{
  onReport: (report: PrivyReport) => void;
  pushHost: HTMLElement | null;
}>;
type PortalLayout = React.ComponentType<{ children: React.ReactNode }>;

/**
 * Public agreement chrome. The Privy SDK is not a static import.
 * A session cookie, OAuth return, or sign-out / SAM click loads the same
 * Providers tree the other sales routes mount up front. Owners then swap
 * to that portal layout, which is the existing role switch.
 */
export function AgreementExperience({ children }: { children: React.ReactNode }) {
  const [wantPrivy, setWantPrivy] = useState(false);
  const [snap, setSnap] = useState<AgreementChromeSnap>(AGREEMENT_CHROME_IDLE);
  const [Mount, setMount] = useState<PrivyMount | null>(null);
  const [PortalLayout, setPortalLayout] = useState<PortalLayout | null>(null);
  const [pushHost, setPushHost] = useState<HTMLElement | null>(null);
  const logoutRef = useRef<() => void>(() => {});

  const ensurePrivy = useCallback(() => {
    setWantPrivy(true);
  }, []);

  const onReport = useCallback((report: PrivyReport) => {
    logoutRef.current = report.logout;
    const next: AgreementChromeSnap = {
      ready: report.ready,
      authenticated: report.authenticated,
      privyUserId: report.privyUserId,
      email: report.email,
      companyName: report.companyName,
      needAgreement: report.needAgreement,
      needSubscription: report.needSubscription,
      role: report.role,
      roleLoading: report.roleLoading,
    };
    setSnap((prev) => (sameAgreementChrome(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    if (clientShouldLoadPrivyImmediately()) setWantPrivy(true);
  }, []);

  useEffect(() => {
    if (!wantPrivy || Mount) return;
    let cancelled = false;
    void import('@/components/sales/AgreementPrivyMount').then((mod) => {
      if (!cancelled) setMount(() => mod.AgreementPrivyMount);
    });
    return () => {
      cancelled = true;
    };
  }, [wantPrivy, Mount]);

  const owner = Boolean(
    snap.ready &&
      snap.authenticated &&
      !snap.roleLoading &&
      snap.role &&
      snap.role !== 'sales_contractor'
  );

  useEffect(() => {
    if (!owner || PortalLayout) return;
    let cancelled = false;
    void import('@/components/sales/SalesPortalLayout').then((mod) => {
      if (!cancelled) setPortalLayout(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [owner, PortalLayout]);

  if (owner && PortalLayout) {
    return <PortalLayout>{children}</PortalLayout>;
  }

  return (
    <>
      {Mount ? <Mount onReport={onReport} pushHost={pushHost} /> : null}
      <AgreementSessionProvider
        ready={snap.ready}
        authenticated={snap.authenticated}
        privyUserId={snap.privyUserId}
        ensurePrivy={ensurePrivy}
      >
        <SalesShellFrame
          email={snap.email}
          companyName={snap.companyName}
          needAgreement={snap.needAgreement}
          needSubscription={snap.needSubscription}
          onLogout={() => {
            if (snap.ready) {
              logoutRef.current();
              return;
            }
            if (!clientShouldLoadPrivyImmediately()) return;
            queueAgreementLogout();
            ensurePrivy();
          }}
          onAskSam={() => {
            if (Mount) {
              window.dispatchEvent(new Event('sa:open-sam'));
              return;
            }
            queueAgreementSam();
            ensurePrivy();
          }}
          headerExtras={
            <span
              ref={(node) => {
                setPushHost((current) => (current === node ? current : node));
              }}
              className="contents"
            />
          }
        >
          {children}
        </SalesShellFrame>
      </AgreementSessionProvider>
    </>
  );
}
