import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { en, type Dict, type DictKey } from './en';

export { en };
export type { Dict, DictKey };

export function resolveDict(dict?: Dict | null) {
  return { ...en, ...(dict || {}) };
}

export function format(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{([\w-]+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export async function loadDict(locale: Locale): Promise<Dict> {
  if (locale === DEFAULT_LOCALE) return en;

  switch (locale) {
    case 'fr':
      return (await import('./fr')).default;
    case 'ar':
      return (await import('./ar')).default;
    case 'pt':
      return (await import('./pt')).default;
    case 'sw':
      return (await import('./sw')).default;
    case 'zu':
      return (await import('./zu')).default;
    default:
      return en;
  }
}

export function t(dict: Dict | null | undefined, key: DictKey | string): string {
  return dict?.[key as DictKey] || en[key as DictKey] || key;
}
