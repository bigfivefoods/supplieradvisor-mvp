'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocaleDictionary } from '@/components/i18n/LocaleDictionaryProvider';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';
import {
  HOME_ANCHOR_PLACEHOLDER_ATTR,
  LAZY_HOME_SECTION_IDS,
  isHomeSectionId,
  isLazyHomeSection,
  subscribeHomeBelowFold,
} from '@/lib/marketing/home-nav-sections';

/**
 * Client boundary for Brief 10: next/dynamic ssr:false is not legal in
 * a Server Component (app/page.tsx). This wrapper keeps mocks off first HTML
 * and waits until the section is near the viewport before fetching it.
 * HomeRecent is a separate chunk and is not prefetched with the module graph.
 *
 * Navbar targets inside this island are also rendered as hidden placeholders
 * so the ids exist on first paint. Scroll waits for the real section.
 */
const HomeBelowFold = dynamic(
  () => import('@/components/marketing/HomeBelowFold'),
  { ssr: false }
);

const HomeRecent = dynamic(
  () => import('@/components/marketing/HomeRecent'),
  { ssr: false }
);

function AnchorPlaceholders({ pending }: { pending: readonly string[] }) {
  if (!pending.length) return null;
  return (
    <div hidden>
      {pending.map((id) => (
        <div key={id} id={id} data-sa-anchor-placeholder="" className="sa-anchor" />
      ))}
    </div>
  );
}

export default function HomeBelowFoldLazy() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [pendingAnchors, setPendingAnchors] = useState<string[]>(() => [...LAZY_HOME_SECTION_IDS]);
  const { locale, t } = useLocaleDictionary();
  const englishBelow = locale !== DEFAULT_LOCALE;

  useLayoutEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && isLazyHomeSection(hash)) setShow(true);
    return subscribeHomeBelowFold(() => setShow(true));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void import('@/components/marketing/HomeBelowFold');
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
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

  useEffect(() => {
    if (!show || pendingAnchors.length === 0) return;
    const dropReady = () => {
      const stillPending = pendingAnchors.filter((id) => {
        if (!isHomeSectionId(id)) return false;
        const nodes = document.querySelectorAll<HTMLElement>(`[id="${id}"]`);
        const real = Array.from(nodes).find(
          (node) => !node.hasAttribute(HOME_ANCHOR_PLACEHOLDER_ATTR)
        );
        return !real;
      });
      if (stillPending.length === pendingAnchors.length) return;
      setPendingAnchors(stillPending);
    };
    dropReady();
    const root = rootRef.current ?? document.body;
    const observer = new MutationObserver(dropReady);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [show, pendingAnchors]);

  return (
    <div ref={rootRef} data-home-below-fold="">
      <AnchorPlaceholders pending={pendingAnchors} />
      {show ? <HomeRecent /> : null}
      {englishBelow ? (
        <p className="mx-auto max-w-screen-2xl px-4 py-2 text-xs font-semibold text-slate-600 sm:px-6 lg:px-10">
          {t('notice.englishOnlySection')}
        </p>
      ) : null}
      <div ref={sentinelRef} lang={englishBelow ? 'en' : undefined} dir={englishBelow ? 'ltr' : undefined}>
        {show ? <HomeBelowFold /> : null}
      </div>
    </div>
  );
}
