export const LOCALES = ['en', 'fr', 'ar', 'pt', 'sw', 'zu'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const RTL_LOCALES = ['ar'] as const;

export const TRANSLATED_PATHS = ['/', '/pricing'] as const;

export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  pt: 'Português',
  sw: 'Kiswahili',
  zu: 'isiZulu',
};

export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_ZA',
  fr: 'fr_FR',
  ar: 'ar_AR',
  pt: 'pt_PT',
  sw: 'sw_KE',
  zu: 'zu_ZA',
};

const LOCALE_PREFIX = new RegExp(`^/(${LOCALES.filter((l) => l !== 'en').join('|')})(?=/|$)`);

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: Locale) {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

export function stripLocale(pathname: string): { locale: Locale; pathname: string } {
  if (!pathname.startsWith('/')) {
    return { locale: DEFAULT_LOCALE, pathname: '/' };
  }

  const match = pathname.match(LOCALE_PREFIX);
  if (!match) {
    return { locale: DEFAULT_LOCALE, pathname: pathname || '/' };
  }

  const locale = match[1] as Locale;
  const stripped = pathname.replace(LOCALE_PREFIX, '') || '/';
  return { locale, pathname: stripped.startsWith('/') ? stripped : `/${stripped}` };
}

export function localizedPath(locale: Locale, pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const { pathname: stripped } = stripLocale(normalized);
  if (locale === DEFAULT_LOCALE) return stripped;
  return stripped === '/' ? `/${locale}` : `/${locale}${stripped}`;
}

export function isTranslatedPath(pathname: string): boolean {
  const { pathname: stripped } = stripLocale(pathname);
  return (TRANSLATED_PATHS as readonly string[]).includes(stripped);
}

export function hreflangAlternates(pathname: string, baseUrl = 'https://www.supplieradvisor.com') {
  const { pathname: stripped } = stripLocale(pathname);
  const alternates: Record<string, string> = {};
  for (const locale of LOCALES) {
    alternates[locale] = `${baseUrl}${localizedPath(locale, stripped)}`;
  }
  alternates['x-default'] = `${baseUrl}${localizedPath(DEFAULT_LOCALE, stripped)}`;
  return alternates;
}
