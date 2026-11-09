'use client';

import { createContext, useContext } from 'react';

const MeSessionHintContext = createContext(false);

/**
 * Server layout reads the existing session cookies and passes a hint so the
 * first HTML can include the member heading. Privy still decides the real session.
 */
export function MeSessionHint({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  return (
    <MeSessionHintContext.Provider value={signedIn}>
      {children}
    </MeSessionHintContext.Provider>
  );
}

export function useMeSessionHint(): boolean {
  return useContext(MeSessionHintContext);
}
