'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

const ProductTour = dynamic(() => import('@/components/preview/ProductTour'), {
  ssr: false,
  loading: () => null,
});

/** Loads the coach-mark UI only when the sample walkthrough is started. */
export default function ProductTourGate() {
  const params = useSearchParams();
  if (params.get('tour') !== '1') return null;
  return <ProductTour />;
}
