'use client';

import dynamic from 'next/dynamic';

const ComparePlatforms = dynamic(() => import('@/components/marketing/ComparePlatforms'), {
  ssr: false,
});

export default function ComparePlatformsClientIsland() {
  return <ComparePlatforms />;
}
