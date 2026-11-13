'use client';

import { createContext, useContext, useMemo } from 'react';

export type AgreementChromeSnap = {
  ready: boolean;
  authenticated: boolean;
  privyUserId: string | null;
  email: string | null;
  companyName: string;
  needAgreement: boolean;
  needSubscription: boolean;
  role: string | null;
  roleLoading: boolean;
};

export const AGREEMENT_CHROME_IDLE: AgreementChromeSnap = {
  ready: false,
  authenticated: false,
  privyUserId: null,
  email: null,
  companyName: '',
  needAgreement: false,
  needSubscription: false,
  role: null,
  roleLoading: true,
};

export type AgreementSessionValue = {
  ready: boolean;
  authenticated: boolean;
  privyUserId: string | null;
  ensurePrivy: () => void;
};

const IDLE_SESSION: AgreementSessionValue = {
  ready: false,
  authenticated: false,
  privyUserId: null,
  ensurePrivy: () => {},
};

const AgreementSessionContext = createContext<AgreementSessionValue>(IDLE_SESSION);

export function AgreementSessionProvider({
  ready,
  authenticated,
  privyUserId,
  ensurePrivy,
  children,
}: AgreementSessionValue & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ ready, authenticated, privyUserId, ensurePrivy }),
    [ready, authenticated, privyUserId, ensurePrivy]
  );
  return (
    <AgreementSessionContext.Provider value={value}>
      {children}
    </AgreementSessionContext.Provider>
  );
}

/** Signed-out default until the deferred Privy mount reports a session. */
export function useAgreementSession() {
  return useContext(AgreementSessionContext);
}

export function sameAgreementChrome(a: AgreementChromeSnap, b: AgreementChromeSnap) {
  return (
    a.ready === b.ready &&
    a.authenticated === b.authenticated &&
    a.privyUserId === b.privyUserId &&
    a.email === b.email &&
    a.companyName === b.companyName &&
    a.needAgreement === b.needAgreement &&
    a.needSubscription === b.needSubscription &&
    a.role === b.role &&
    a.roleLoading === b.roleLoading
  );
}
