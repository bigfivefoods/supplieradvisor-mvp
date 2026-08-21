/** Company logo from profiles.logo_url (My Business → Profile). */

/** AVIF/HEIC in Storage is not a valid PWA icon — use Supabase PNG render. */
export function preferPngLogoUrl(url: string | null | undefined): string | null {
  const s = String(url || '').trim();
  if (!s) return null;
  if (!/\.(avif|heic|heif)(\?|#|$)/i.test(s)) return s;
  try {
    const u = new URL(s);
    if (!u.hostname.endsWith('.supabase.co')) return s;
    const m = u.pathname.match(/^\/storage\/v1\/object\/public\/(.+)$/);
    if (!m) return s;
    return `${u.origin}/storage/v1/render/image/public/${m[1]}?width=1024`;
  } catch {
    return s;
  }
}

export function pickCompanyLogoUrl(
  row?: { logo_url?: unknown } | null
): string | null {
  return preferPngLogoUrl(String(row?.logo_url || '').trim() || null);
}

export function applyCompanyLogoToSettings(
  store: { settings?: object | null },
  logoUrl: string | null
): void {
  const prev =
    store.settings && typeof store.settings === 'object' ? store.settings : {};
  store.settings = {
    ...prev,
    company_logo_url: preferPngLogoUrl(logoUrl) || logoUrl,
  };
}

export function logoUrlFromSettings(settings?: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const s = String(
    (settings as { company_logo_url?: unknown }).company_logo_url || ''
  ).trim();
  return preferPngLogoUrl(s || null);
}

/** Profile logo, then Advisor settings company_logo_url. */
export function resolveCompanyLogoUrl(opts: {
  profileLogoUrl?: unknown;
  settings?: unknown;
}): string | null {
  return (
    pickCompanyLogoUrl({ logo_url: opts.profileLogoUrl }) ||
    logoUrlFromSettings(opts.settings)
  );
}
