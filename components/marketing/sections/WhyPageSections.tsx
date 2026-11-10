import ComparePlatforms from '@/components/marketing/ComparePlatforms';
import SocialProofStrip from '@/components/marketing/SocialProofStrip';
import SuperCubeStory from '@/components/marketing/SuperCubeStory';
import { interactiveDemoHref } from '@/lib/preview/production-gate';

export default function WhyPageSections() {
  const demoHref = interactiveDemoHref();
  return (
    <>
      <section id="why-join" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-slate-900">Why teams choose SupplierAdvisor®</h2>
        <p className="mt-3 text-slate-600">
          Replace fragmented tools with one operating system, backed by a verified trade and trust layer built for real operators.
        </p>
      </section>
      <ComparePlatforms />
      <SocialProofStrip />
      <SuperCubeStory demoHref={demoHref} />
    </>
  );
}
