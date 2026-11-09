'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { fetchSalesAgreement } from '@/lib/sales-contractor/agreement-client';
import { consumeAgreementLogout } from '@/components/sales/agreement-pending';

/**
 * Session, company switch, and agreement lock for the sales contractor shell.
 * Must run under PrivyProvider. /sales/agreement keeps the shell on screen
 * while Privy is signed out; every other sales route still goes to /login.
 */
export function useSalesShellSession() {
  const { ready, authenticated, logout, user } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();
  const email = extractEmailFromPrivyUser(user);
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = typeof window !== 'undefined' ? getSelectedCompanyId() : null;
  const [companyName, setCompanyName] = useState('');
  const [needAgreement, setNeedAgreement] = useState(false);
  const [needSubscription, setNeedSubscription] = useState(false);
  const onAgreement = Boolean(pathname?.startsWith('/sales/agreement'));

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      // The agreement heading is the page. Sending logged-out visitors to
      // /login replaced that heading after Privy booted and made LCP the
      // login screen. Signing still requires a session.
      if (!onAgreement) {
        router.replace(`/login?next=${encodeURIComponent(pathname || '/sales')}`);
      }
      return;
    }
    if (!companyId) {
      router.replace('/dashboard/select-company');
    }
  }, [ready, authenticated, companyId, router, pathname, onAgreement]);

  useEffect(() => {
    if (!ready || !onAgreement) return;
    if (!consumeAgreementLogout()) return;
    void logout();
  }, [ready, onAgreement, logout]);

  useEffect(() => {
    if (!companyId || !privyUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          companyId: String(companyId),
          privyUserId,
        });
        const { ok, data } = await fetchSalesAgreement(params.toString());
        if (cancelled) return;
        if (ok) {
          setCompanyName(data.companyName || '');
          if (data.subscriptionExempt || !data.isSalesContractor) {
            setNeedAgreement(false);
            setNeedSubscription(false);
            return;
          }
          const signed = Boolean(data.signed);
          const subOk = Boolean(data.subscriptionActive);
          setNeedAgreement(!signed);
          setNeedSubscription(signed && !subOk);
          if (!signed && pathname && !pathname.startsWith('/sales/agreement')) {
            router.replace('/sales/agreement');
            return;
          }
          if (
            signed &&
            !subOk &&
            pathname &&
            !pathname.startsWith('/sales/subscribe') &&
            !pathname.startsWith('/sales/agreement')
          ) {
            router.replace('/sales/subscribe');
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId, pathname, router]);

  return {
    ready,
    authenticated,
    email,
    companyName,
    needAgreement,
    needSubscription,
    logout,
    privyUserId,
    onAgreement,
  };
}
