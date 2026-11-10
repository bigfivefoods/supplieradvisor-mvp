import HomeBelowFold from '@/components/marketing/HomeBelowFold';
import ComparePlatformsClientIsland from '@/components/marketing/sections/ComparePlatformsClientIsland';

export default function WhyPageSections() {
  return (
    <>
      <HomeBelowFold
        tourHref="/join"
        demoHref="/join"
        sections={['why-join']}
      />
      <ComparePlatformsClientIsland />
      <HomeBelowFold
        tourHref="/join"
        demoHref="/join"
        sections={['proof', 'super-cube']}
      />
    </>
  );
}
