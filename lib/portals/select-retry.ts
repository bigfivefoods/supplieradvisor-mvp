/** PostgREST "column X does not exist" / schema-cache misses. */
export function missingSelectColumn(message: string | null | undefined): string | null {
  const m =
    /column\s+(?:[\w]+\.)?(\w+)\s+does not exist/i.exec(message || '') ||
    /Could not find the ['"](\w+)['"] column/i.exec(message || '');
  return m?.[1] || null;
}

export function stripSelectColumn(select: string, col: string): string {
  const next = select
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c && c !== col)
    .join(', ');
  return next;
}

export function isFkViolation(message: string | null | undefined): boolean {
  return /23503|foreign key/i.test(message || '');
}
