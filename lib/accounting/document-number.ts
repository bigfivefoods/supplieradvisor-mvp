/** Matches sa_next_document_number: PREFIX-00001 */
export function formatDocumentNumber(prefix: string, n: number): string {
  const safePrefix = String(prefix || 'DOC').trim() || 'DOC';
  const num = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return `${safePrefix}-${String(num).padStart(5, '0')}`;
}
