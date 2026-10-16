import type { AccountState } from './types';

/** States the accounts screen may take from `?state=`. Anything else is no filter. */
export const ACCOUNT_STATE_FILTERS = [
  'active',
  'arrangement',
  'dispute',
  'legal',
  'paid',
  'recalled',
  'closed',
  'prescribed',
  'stopped',
] as const satisfies readonly AccountState[];

export function accountStateFromQuery(value: string | null | undefined): AccountState | '' {
  if (!value) return '';
  return (ACCOUNT_STATE_FILTERS as readonly string[]).includes(value) ? (value as AccountState) : '';
}

/**
 * Preview links keep `role` and `book` from the shell and `state` from the step.
 * Query pairs are merged with URLSearchParams. A key already on the path wins.
 */
export function mapRecoverHref(path: string, base: string | null | undefined): string {
  if (!base) return path;
  const root = '/dashboard/recovergraph';
  const hashAt = path.indexOf('#');
  const hash = hashAt >= 0 ? path.slice(hashAt) : '';
  const withoutHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const queryAt = withoutHash.indexOf('?');
  const pathOnly = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash;
  const pathQuery = queryAt >= 0 ? withoutHash.slice(queryAt + 1) : '';
  if (pathOnly !== root && !pathOnly.startsWith(`${root}/`)) return path;
  const baseQueryAt = base.indexOf('?');
  const basePath = baseQueryAt >= 0 ? base.slice(0, baseQueryAt) : base;
  const baseQuery = baseQueryAt >= 0 ? base.slice(baseQueryAt + 1) : '';
  const rel = pathOnly === root ? '' : pathOnly.slice(root.length);
  const params = new URLSearchParams(pathQuery);
  const extra = new URLSearchParams(baseQuery);
  extra.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  const qs = params.toString();
  return `${basePath}${rel}${qs ? `?${qs}` : ''}${hash}`;
}
