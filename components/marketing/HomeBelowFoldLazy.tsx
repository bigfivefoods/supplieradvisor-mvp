'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

/**
 * Client boundary for Brief 10: next/dynamic ssr:false is not legal in
 * a Server Component (app/page.tsx). This wrapper keeps mocks off first HTML
 * and waits until the section is near the viewport before fetching it.
 */
const HomeBelowFold = dynamic(
  () => import('@/components/marketing/HomeBelowFold'),
  { ssr: false }
);

export default function HomeBelowFoldLazy() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

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

  return <div ref={ref}>{show ? <HomeBelowFold /> : null}</div>;
}
