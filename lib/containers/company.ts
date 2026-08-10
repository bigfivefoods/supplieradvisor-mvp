/** Client-side selected company helpers */
export function getSelectedCompanyId(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('selectedCompanyId');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setSelectedCompanyId(
  companyId: number,
  opts?: { name?: string | null }
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('selectedCompanyId', String(companyId));
    if (opts?.name) {
      localStorage.setItem('selectedCompanyName', String(opts.name));
    }
  } catch {
    /* ignore */
  }
}

export function getSelectedCompanyName(): string {
  if (typeof window === 'undefined') return 'Your company';
  try {
    return localStorage.getItem('selectedCompanyName') || 'Your company';
  } catch {
    return 'Your company';
  }
}
