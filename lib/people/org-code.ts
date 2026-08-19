/** Short uppercase code from a display name, e.g. "Consulting" → "BU-CONSULTING". */
export function suggestOrgCode(name: string, prefix: string): string {
  const slug = String(name || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .toUpperCase()
    .slice(0, 12);
  const tail = slug || Date.now().toString(36).toUpperCase().slice(-6);
  const head = String(prefix || 'ORG').trim().toUpperCase() || 'ORG';
  return `${head}-${tail}`;
}
