/**
 * Public gym join URLs.
 * Kept out of gym-grow-share so member-app code does not pull the
 * movement catalogue or the rest of the gym store.
 */
export function gymJoinMemberPath(
  publicToken: string,
  kind?: 'group' | 'private' | 'both'
) {
  const base = `/join/fitgraph/${encodeURIComponent(publicToken)}`;
  if (kind === 'private') return `${base}?kind=private`;
  if (kind === 'both') return `${base}?kind=both`;
  return `${base}?kind=group`;
}
