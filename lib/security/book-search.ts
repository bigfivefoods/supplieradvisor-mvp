/**
 * Build a PostgREST `.or()` ilike clause for CRM / SRM book search.
 * Strips filter metacharacters so commas and wildcards cannot widen the query.
 */
export function bookIlikeOr(q: string, columns: string[]): string | null {
  const raw = String(q || '')
    .replace(/[%_,()*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (raw.length < 2 || !columns.length) return null;
  const term = `%${raw}%`;
  return columns.map((c) => `${c}.ilike.${term}`).join(',');
}
