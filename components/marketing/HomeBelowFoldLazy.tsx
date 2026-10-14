'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocaleDictionary } from '@/components/i18n/LocaleDictionaryProvider';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';

/**
 * Client boundary for Brief 10: next/dynamic ssr:false is not legal in
 * a Server Component (app/page.tsx). This wrapper keeps mocks off first HTML
 * and waits until the section is near the viewport before fetching it.
 * HomeRecent is a separate chunk and is not prefetched with the module graph.
 */
const HomeBelowFold = dynamic(
  () => import('@/components/marketing/HomeBelowFold'),
  { ssr: false }
);

const HomeRecent = dynamic(
  () => import('@/components/marketing/HomeRecent'),
  { ssr: false }
);

export default function HomeBelowFoldLazy() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const { locale, t } = useLocaleDictionary();
  const englishBelow = locale !== DEFAULT_LOCALE;

  useEffect(() => {
    const id = window.setTimeout(() => {
      void import('@/components/marketing/HomeBelowFold');
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {show ? <HomeRecent /> : null}
      {englishBelow ? (
        <p className="mx-auto max-w-screen-2xl px-4 py-2 text-xs font-semibold text-slate-600 sm:px-6 lg:px-10">
          {t('notice.englishOnlySection')}
        </p>
      ) : null}
      <div ref={ref} lang={englishBelow ? 'en' : undefined} dir={englishBelow ? 'ltr' : undefined}>
        {show ? <HomeBelowFold /> : null}
      </div>
    </>
  );
}
