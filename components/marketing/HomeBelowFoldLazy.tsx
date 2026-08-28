'use client';

import dynamic from 'next/dynamic';

/**
 * Client boundary for Brief 10: next/dynamic ssr:false is not legal in
 * a Server Component (app/page.tsx). This wrapper keeps mocks off first HTML.
 */
const HomeBelowFold = dynamic(
  () => import('@/components/marketing/HomeBelowFold'),
  { ssr: false }
);

export default function HomeBelowFoldLazy() {
  return <HomeBelowFold />;
}
