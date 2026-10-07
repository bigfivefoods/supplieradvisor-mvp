import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { en, loadDict, resolveDict, type Dict } from '@/lib/i18n/dict';

export async function getLocaleDict(locale: Locale): Promise<Dict> {
  if (locale === DEFAULT_LOCALE) return en;
  return resolveDict(await loadDict(locale));
}
