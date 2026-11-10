import dynamic from 'next/dynamic';
import HomeBelowFold from '@/components/marketing/HomeBelowFold';

const ComparePlatformsLazy = dynamic(() => import('@/components/marketing/ComparePlatforms'), {
  ssr: false,
});

export default function WhyPageSections() {
  return (
    <>
      <HomeBelowFold
        tourHref="/join"
        demoHref="/join"
        sections={['why-join']}
      />
      <ComparePlatformsLazy />
      <HomeBelowFold
        tourHref="/join"
        demoHref="/join"
        sections={['proof', 'super-cube']}
      />
    </>
  );
}
