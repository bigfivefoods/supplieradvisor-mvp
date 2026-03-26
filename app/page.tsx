'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ShieldCheck, Truck, Users, Factory, Leaf, Zap, Globe, Building2, BookOpen, Users2, Award, Heart } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useRef, useEffect } from 'react';

export default function LandingPage() {
  const { login } = usePrivy();
  const videoRef = useRef<HTMLVideoElement>(null);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.playsInline = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 overflow-x-hidden">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-12 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Image 
              src="/sa-logo.png" 
              alt="SupplierAdvisor" 
              width={48} 
              height={48} 
              className="rounded-3xl object-contain" 
              priority 
            />
            <div className="text-3xl font-black tracking-[-2px]">SupplierAdvisor®</div>
          </div>

          <div className="flex items-center gap-4 md:gap-10 text-sm md:text-base font-medium flex-wrap">
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-[#00b4d8] transition-colors">How it Works</button>
            <button onClick={() => scrollToSection('for-consumers')} className="hover:text-[#00b4d8] transition-colors">For Consumers</button>
            <button onClick={() => scrollToSection('for-business')} className="hover:text-[#00b4d8] transition-colors">For Business</button>
            <button onClick={() => scrollToSection('for-society')} className="hover:text-[#00b4d8] transition-colors">For Society</button>
            <button onClick={() => scrollToSection('for-humanity')} className="hover:text-[#00b4d8] transition-colors">For Humanity</button>
            <button
              onClick={login}
              className="px-6 md:px-8 py-3.5 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
            >
              Join the Beta <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO with 4K Video */}
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="https://picsum.photos/id/1015/2560/1440"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source 
            src="https://videos.pexels.com/video-files/11979793/11979793-uhd_2560_1440_30fps.mp4" 
            type="video/mp4" 
          />
        </video>

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />

        <div className="relative z-10 max-w-4xl mx-auto text-center px-6 pt-32">
          <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-3xl px-6 py-2 mb-8 shadow-sm mt-5">
            <Globe size={20} className="text-[#00b4d8]" />
            <span className="font-semibold text-slate-700">Farm-to-Fork • On-Chain • AI-Powered</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[-4px] leading-none text-white mb-8">
            Verified.<br />
            Transparent.<br />
            Accelerating humanity.
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-5">
            SupplierAdvisor® is the B2B &amp; B2C supply-chain platform that combines<br />
            blockchain verification, real-time AI insights, and ethical transparency to make every transaction trustworthy.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pb-5">
            <Link
              href="/onboarding?type=business"
              className="btn-primary text-lg md:text-xl px-10 py-6 rounded-3xl flex items-center gap-3 text-white"
            >
              Register Your Business <ArrowRight size={24} />
            </Link>
            <Link
              href="/onboarding?type=consumer"
              className="px-10 py-6 border-2 border-white/70 hover:border-white text-lg md:text-xl font-medium text-white rounded-3xl flex items-center gap-3"
            >
              Shop as a Conscious Consumer
            </Link>
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div id="how-it-works" className="bg-white py-12 sm:py-16 md:py-24 px-6 md:px-12">
        <div className="max-w-screen-2xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] text-center mb-6 text-[#00b4d8]">How SupplierAdvisor® Works</h2>
          <p className="text-lg md:text-xl text-slate-600 text-center max-w-2xl mx-auto mb-12 md:mb-16">
            We don’t just connect buyers and sellers — we build the transparent, ethical, and efficient backbone the world needs to progress humanity.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="card p-6 md:p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl">1</div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">Verify &amp; Onboard</h3>
              <p className="text-slate-600">Every business completes world-class onboarding with certificates, bank details, and location metadata. AI + human verification ensures trust from day one.</p>
            </div>
            <div className="card p-6 md:p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl">2</div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">Connect &amp; Transact</h3>
              <p className="text-slate-600">Send connection requests, raise POs, ship with live GPS/IoT tracking, and mint everything on-chain. RIAD, ratings, and OTIFEF metrics are embedded in every step.</p>
            </div>
            <div className="card p-6 md:p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl">3</div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">Track &amp; Improve</h3>
              <p className="text-slate-600">Consumers scan QR codes for full traceability. Businesses get AI-powered insights, risk alerts, and sustainability dashboards. Every transaction makes the world better.</p>
            </div>
          </div>
        </div>
      </div>

      {/* For Consumers */}
      <div id="for-consumers" className="py-12 sm:py-16 md:py-24 px-6 md:px-12 bg-white">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-7">
              <div className="card p-6 sm:p-8 md:p-12 text-base md:text-lg space-y-10">
                <div className="flex gap-6">
                  <ShieldCheck className="text-emerald-500 flex-shrink-0" size={32} />
                  <div><strong>Scan any product</strong> — Instantly see the full verified journey from farm to your table.</div>
                </div>
                <div className="flex gap-6">
                  <Users className="text-amber-500 flex-shrink-0" size={32} />
                  <div><strong>Support ethical brands</strong> — Shop only from verified, high-rated businesses with transparent reviews.</div>
                </div>
                <div className="flex gap-6">
                  <Leaf className="text-[#00b4d8] flex-shrink-0" size={32} />
                  <div><strong>Real impact</strong> — Your purchases directly fund regenerative farming, fair wages, and sustainable practices.</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-5">
              <div className="sticky top-8">
                <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-3xl mb-6">
                  <Leaf className="text-[#00b4d8]" size={28} />
                  <span className="font-bold text-xl">For Consumers</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] leading-none mb-8">
                  Shop with total confidence and real impact
                </h2>
                <p className="text-xl md:text-2xl text-slate-600">Every purchase you make is traceable, ethical, and contributes to a better world.</p>
                <Link href="/onboarding?type=consumer" className="btn-primary inline-flex mt-12 text-xl px-10 py-6">
                  Join as a Conscious Consumer <ArrowRight className="ml-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* For Business */}
      <div id="for-business" className="py-12 sm:py-16 md:py-24 px-6 md:px-12 bg-[#f8fafc]">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-5">
              <div className="sticky top-8">
                <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-3xl mb-6">
                  <Factory className="text-[#00b4d8]" size={28} />
                  <span className="font-bold text-xl">For Business</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] leading-none mb-8">
                  The most powerful supply-chain operating system ever built
                </h2>
                <p className="text-xl md:text-2xl text-slate-600">From verified suppliers to on-chain POs and live logistics — SupplierAdvisor® gives you total visibility, trust, and speed.</p>
                <Link href="/onboarding?type=business" className="btn-primary inline-flex mt-12 text-xl px-10 py-6">
                  Register Your Business <ArrowRight className="ml-3" />
                </Link>
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="card p-6 sm:p-8 md:p-12 text-base md:text-lg space-y-10">
                <div className="flex gap-6">
                  <ShieldCheck className="text-emerald-500 flex-shrink-0" size={32} />
                  <div><strong>Verified ecosystem</strong> — Every participant is fully vetted with certificates, financials, and location metadata.</div>
                </div>
                <div className="flex gap-6">
                  <Zap className="text-[#00b4d8] flex-shrink-0" size={32} />
                  <div><strong>AI + on-chain intelligence</strong> — Smart matching, predictive OTIFEF, RIAD embedded in every module.</div>
                </div>
                <div className="flex gap-6">
                  <Truck className="text-amber-500 flex-shrink-0" size={32} />
                  <div><strong>Live end-to-end traceability</strong> — GPS, IoT, CoA, Incoterms, and proof-of-delivery on the blockchain.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* For Society */}
      <div id="for-society" className="py-12 sm:py-16 md:py-24 px-6 md:px-12 bg-white">
        <div className="max-w-screen-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-3xl mb-6">
              <Globe className="text-[#00b4d8]" size={28} />
              <span className="font-bold text-xl">For Society</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] leading-none mb-6 text-[#00b4d8]">
              Governments • Schools • Associations
            </h2>
            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto">
              SupplierAdvisor® is not just for businesses — it is the platform that empowers every institution and group to operate with total transparency, intelligence, and impact.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="card p-6 sm:p-8 md:p-12 group">
              <Building2 className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Government &amp; Public Sector</h3>
              <p className="text-slate-600 mb-8">
                Run transparent tenders, eliminate corruption, and deliver services with full traceability. Get real-time public feedback on service levels. Use our AI Leadership Lab and RIAD tools to drive intelligent policy decisions and dramatically improve service delivery.
              </p>
              <Link href="/onboarding?type=government" className="text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all mt-8">
                Register as a Government Entity <ArrowRight size={18} />
              </Link>
            </div>

            <div className="card p-6 sm:p-8 md:p-12 group">
              <BookOpen className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Schools &amp; Educational Institutions</h3>
              <p className="text-slate-600 mb-8">
                Track every rand spent on school nutrition, uniforms, and supplies with full traceability down to each pupil. Monitor performance, spending efficiency, and food safety in real time. Receive AI-powered insights to improve outcomes and accountability.
              </p>
              <Link href="/onboarding?type=school" className="text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all mt-8">
                Register Your School <ArrowRight size={18} />
              </Link>
            </div>

            <div className="card p-6 sm:p-8 md:p-12 group">
              <Users2 className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Associations, Cooperatives &amp; Groups</h3>
              <p className="text-slate-600 mb-8">
                Consolidate your members (companies, farmers, individuals) on one platform. Unlock collective intelligence, shared metrics, benchmarking, and powerful insights. Drive industry-wide improvement, advocacy, and collective bargaining power.
              </p>
              <Link href="/onboarding?type=association" className="text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all mt-8">
                Register Your Association <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* For Humanity */}
      <div id="for-humanity" className="py-12 sm:py-16 md:py-24 px-6 md:px-12 bg-[#f8fafc]">
        <div className="max-w-screen-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-3xl mb-6">
              <Heart className="text-[#00b4d8]" size={28} />
              <span className="font-bold text-xl">For Humanity</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] leading-none mb-6 text-[#00b4d8]">
              One Platform.<br />One Purpose.
            </h2>
            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto">
              SupplierAdvisor® unites ethical sourcing, world-class leadership development, and AI intelligence to solve humanity’s most pressing challenges and advance a more just, sustainable world.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="card p-6 sm:p-8 md:p-12 group">
              <Globe className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Ethical Sourcing &amp; UN SDGs</h3>
              <p className="text-slate-600 mb-8">
                Every transaction on the platform directly advances multiple United Nations Sustainable Development Goals — from Zero Hunger and Responsible Consumption to Climate Action and Strong Institutions — through verified ethical sourcing and full supply-chain transparency, using our leading project management tools (Prince2, PMP, Gantt, Kanban board options) to project manage all internal and external projects.
              </p>
            </div>

            <div className="card p-6 sm:p-8 md:p-12 group">
              <Award className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Super-Cube® Leadership</h3>
              <p className="text-slate-600 mb-8">
                Built on Dr. Craig R. Muller’s doctoral Super-Cube® leadership development model and integrated with AI-powered assessments, learning material, and steps to improve leadership at every level to make wiser, faster, and more ethical decisions that drive real systemic change.
              </p>
            </div>

            <div className="card p-6 sm:p-8 md:p-12 group">
              <Zap className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">A Better World<br />Together</h3>
              <p className="text-slate-600 mb-8">
                When governments, businesses, schools, associations, and conscious consumers unite on one verified, on-chain platform, we create unprecedented collective intelligence. Together we solve complex global problems — from ESG compliance to climate resilience — and accelerate humanity’s progress toward a more ethical, transparent, and prosperous future.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-slate-900 text-white py-12 sm:py-16 md:py-24 px-6 md:px-12 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black tracking-[-2px] mb-6">The future of supply chains is here.</h2>
          <p className="text-xl md:text-2xl mb-12">Join the movement that makes transparency the standard and ethics the competitive advantage.</p>
          <button onClick={login} className="px-12 md:px-16 py-6 md:py-7 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl text-xl md:text-2xl font-semibold inline-flex items-center gap-4">
            Get started in under 5 minutes <ArrowRight size={28} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white/70 py-12 px-6 text-center text-sm border-t border-slate-800">
        <div className="max-w-screen-2xl mx-auto">
          <div className="font-black tracking-[-0.5px] mb-3">SupplierAdvisor® 2026 ©</div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-x-8 gap-y-2 text-xs">
            <a href="mailto:connect@supplieradvisor.com" className="hover:text-white transition-colors">connect@supplieradvisor.com</a>
            <a href="tel:+27825814215" className="hover:text-white transition-colors">+27 (0) 82 581 4215</a>
            <span>21A Old Howick Road, Pietermaritzburg, KwaZulu-Natal, South Africa</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
