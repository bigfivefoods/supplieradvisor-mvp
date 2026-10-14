import { Suspense } from 'react';
import type { Metadata } from 'next';
import ProductTourGate from '@/components/preview/ProductTourGate';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <ProductTourGate />
      </Suspense>
    </>
  );
}
