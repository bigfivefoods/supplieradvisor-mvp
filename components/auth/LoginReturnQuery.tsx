'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginAuthShell } from '@/components/auth/LoginAuthShell';
import { safeNextPath } from '@/lib/auth/safe-next';

type LoginQuery = {
  next: string;
  email: string;
  claimed: string;
};

const EMPTY_QUERY: LoginQuery = { next: '', email: '', claimed: '' };

function readWindowQuery(): LoginQuery {
  if (typeof window === 'undefined') return EMPTY_QUERY;
  const params = new URLSearchParams(window.location.search);
  return {
    next: params.get('next') || '',
    email: (params.get('email') || '').trim(),
    claimed: params.get('claimed') || '',
  };
}

/** Keeps the server page static. Suspense owns the client read of the URL. */
function LoginSearchProbe({ onQuery }: { onQuery: (query: LoginQuery) => void }) {
  const params = useSearchParams();
  useEffect(() => {
    const fromWindow = readWindowQuery();
    onQuery({
      next: params.get('next') || fromWindow.next,
      email: (params.get('email') || '').trim() || fromWindow.email,
      claimed: params.get('claimed') || fromWindow.claimed,
    });
  }, [params, onQuery]);
  return null;
}

export function LoginReturnQuery({
  logo,
  features,
  footer,
}: {
  logo: ReactNode;
  features: ReactNode;
  footer: ReactNode;
}) {
  const [query, setQuery] = useState<LoginQuery>(EMPTY_QUERY);

  useEffect(() => {
    setQuery(readWindowQuery());
  }, []);

  const nextFromQuery = safeNextPath(query.next);
  const prefillEmail = query.email;
  const isContractorFlow =
    nextFromQuery.startsWith('/contractor') || nextFromQuery.includes('contractor');
  const isMemberFlow = nextFromQuery.startsWith('/me');

  return (
    <>
      <Suspense fallback={null}>
        <LoginSearchProbe onQuery={setQuery} />
      </Suspense>

      <div className="text-center mb-8 sm:mb-10">
        {logo}
        <h1 className="sa-text-brand-on-light mb-2 text-3xl font-black tracking-[-2px] sm:text-4xl">
          {isMemberFlow ? 'SA Member' : 'Welcome back'}
        </h1>
        <p className="text-neutral-600 text-sm sm:text-base px-2">
          {isContractorFlow
            ? 'Independent contractor operator portal'
            : isMemberFlow
              ? 'Create a free personal account, or sign in if you already have one'
              : 'Company workspace, or SA Member if you are a customer'}
        </p>
      </div>

      {query.claimed ? (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm">
          Account ready. Sign in with the same email you used for your invitation.
        </div>
      ) : null}

      {isContractorFlow && prefillEmail ? (
        <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 text-sm">
          Operator invite — sign in with <strong>{prefillEmail}</strong>
        </div>
      ) : null}

      <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-5 sm:space-y-6">
        {features}
        <LoginAuthShell
          prefillEmail={prefillEmail || undefined}
          nextFromQuery={nextFromQuery}
        />
        {footer}
      </div>
    </>
  );
}
