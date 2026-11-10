import Link from 'next/link';
import HomeRecent from '@/components/marketing/HomeRecent';
import HomeBelowFold from '@/components/marketing/HomeBelowFold';

export default function ProductPageSections({ tourHref }: { tourHref: string }) {
  return (
    <>
      <HomeBelowFold
        tourHref={tourHref}
        demoHref="/join"
        sections={['video', 'stack', 'systems']}
      />
      <div className="px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-screen-2xl py-8">
          <Link href="/catalogues" className="font-semibold text-[#0077b6] underline underline-offset-4">Browse catalogues</Link>
        </div>
      </div>
      <HomeRecent tourHref={tourHref} />
    </>
  );
}
