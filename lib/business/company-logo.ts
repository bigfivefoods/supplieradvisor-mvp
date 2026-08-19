/** Company logo from profiles.logo_url (My Business → Profile). */

export function pickCompanyLogoUrl(
  row?: { logo_url?: unknown } | null
): string | null {
  const s = String(row?.logo_url || '').trim();
  return s || null;
}

export function applyCompanyLogoToSettings(
  store: { settings?: object | null },
  logoUrl: string | null
): void {
  const prev =
    store.settings && typeof store.settings === 'object' ? store.settings : {};
  store.settings = {
    ...prev,
    company_logo_url: logoUrl,
  };
}

export function logoUrlFromSettings(settings?: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const s = String(
    (settings as { company_logo_url?: unknown }).company_logo_url || ''
  ).trim();
  return s || null;
}
