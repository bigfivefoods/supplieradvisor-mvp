'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, stripLocale, type Locale } from '@/lib/i18n/config';
import { en, loadDict, resolveDict, t as translate, type Dict, type DictKey } from '@/lib/i18n/dict';

type LocaleDictionaryContextValue = {
  locale: Locale;
  dict: Dict;
  t: (key: DictKey | string) => string;
};

const LocaleDictionaryContext = createContext<LocaleDictionaryContextValue>({
  locale: DEFAULT_LOCALE,
  dict: en,
  t: (key) => en[key as DictKey] || String(key),
});

function readSeededDict(): Dict | null {
  if (typeof document === 'undefined') return null;
  const node = document.getElementById('sa-locale-data');
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as Dict;
  } catch {
    return null;
  }
}

export function LocaleDictionaryProvider({
  children,
  initialLocale,
  initialDict,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  initialDict?: Dict;
}) {
  const pathname = usePathname() || '/';
  const detected = stripLocale(pathname).locale;
  const startingLocale = initialLocale || detected;
  const [locale, setLocale] = useState<Locale>(startingLocale);
  const [dict, setDict] = useState<Dict>(() => resolveDict(initialDict || readSeededDict() || en));

  useEffect(() => {
    let cancelled = false;
    const nextLocale = stripLocale(pathname).locale;
    setLocale(nextLocale);

    if (initialLocale && nextLocale === initialLocale && initialDict) {
      setDict(resolveDict(initialDict));
      return;
    }

    if (nextLocale === DEFAULT_LOCALE) {
      setDict(en);
      return;
    }

    const seeded = readSeededDict();
    if (seeded) {
      setDict(resolveDict(seeded));
      return;
    }

    loadDict(nextLocale).then((nextDict) => {
      if (!cancelled) setDict(resolveDict(nextDict));
    });

    return () => {
      cancelled = true;
    };
  }, [initialDict, initialLocale, pathname]);

  const value = useMemo<LocaleDictionaryContextValue>(
    () => ({
      locale,
      dict,
      t: (key) => translate(dict, key),
    }),
    [dict, locale]
  );

  return <LocaleDictionaryContext.Provider value={value}>{children}</LocaleDictionaryContext.Provider>;
}

export function useLocaleDictionary() {
  return useContext(LocaleDictionaryContext);
}
