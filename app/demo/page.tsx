import LandingNav from '@/components/marketing/LandingNav';
import InteractiveDemoMain from '@/components/marketing/InteractiveDemoMain';
import SiteFooter from '@/components/marketing/SiteFooter';

export default function InteractiveDemoPage() {
  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav />
      <InteractiveDemoMain />
      <SiteFooter />
    </div>
  );
}
