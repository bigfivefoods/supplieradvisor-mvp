import { NextResponse } from 'next/server';

/** Private KPI GET/POSTs — stale for 15–60s is fine. */
export const KPI_CACHE_CONTROL =
  'private, max-age=15, stale-while-revalidate=45';

/** Money, webhooks, invites, checkout — never cache. */
export const NO_STORE_CACHE_CONTROL = 'private, no-store';

type JsonInit = {
  status?: number;
  headers?: Record<string, string>;
};

export function jsonKpi(data: unknown, init?: JsonInit): NextResponse {
  return NextResponse.json(data, {
    status: init?.status,
    headers: {
      'Cache-Control': KPI_CACHE_CONTROL,
      ...(init?.headers || {}),
    },
  });
}

export function jsonNoStore(data: unknown, init?: JsonInit): NextResponse {
  return NextResponse.json(data, {
    status: init?.status,
    headers: {
      'Cache-Control': NO_STORE_CACHE_CONTROL,
      ...(init?.headers || {}),
    },
  });
}
