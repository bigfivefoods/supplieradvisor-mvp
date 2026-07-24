'use client';

/**
 * Hook: company + Privy identity + authenticated apiFetch/apiJson.
 */
import { useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { apiFetch, apiJson, type ApiFetchOptions } from '@/lib/client/api-fetch';

export function useApiAuth() {
  const { user, authenticated, getAccessToken } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();

  const resolveToken = useCallback(async (): Promise<string | null> => {
    try {
      if (authenticated && typeof getAccessToken === 'function') {
        return await getAccessToken();
      }
    } catch {
      /* cookie fallback */
    }
    return null;
  }, [authenticated, getAccessToken]);

  const withAuth = useCallback(
    async (path: string, opts: Omit<ApiFetchOptions, 'accessToken' | 'companyId' | 'privyUserId'> = {}) => {
      const accessToken = await resolveToken();
      return apiFetch(path, {
        ...opts,
        accessToken,
        companyId: companyId ?? undefined,
        privyUserId: privyUserId ?? undefined,
      });
    },
    [companyId, privyUserId, resolveToken]
  );

  const withAuthJson = useCallback(
    async <T = Record<string, unknown>>(
      path: string,
      opts: Omit<ApiFetchOptions, 'accessToken' | 'companyId' | 'privyUserId'> = {}
    ) => {
      const accessToken = await resolveToken();
      return apiJson<T>(path, {
        ...opts,
        accessToken,
        companyId: companyId ?? undefined,
        privyUserId: privyUserId ?? undefined,
      });
    },
    [companyId, privyUserId, resolveToken]
  );

  return {
    companyId,
    privyUserId,
    authenticated,
    withAuth,
    withAuthJson,
    resolveToken,
  };
}
