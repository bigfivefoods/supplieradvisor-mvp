'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ShieldCheck, Truck, Users, Factory, Leaf, Zap, Globe } from 'lucide-react';
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
      video.play().catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 overflow-x-hidden">
      {/* Top Navigation — unchanged */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-12 py-5 flex items-center justify-between">
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

          <div className="flex items-center gap-10 text-lg font-medium">
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-[#00b4d8] transition-colors">How it Works</button>
            <button onClick={() => scrollToSection('for-business')} className="hover:text-[#00b4d8] transition-colors">For Business</button>
            <button onClick={() => scrollToSection('for-consumers')} className="hover:text-[#00b4d8] transition-colors">For Consumers</button>
            <button
              onClick={login}
              className="px-8 py-3.5 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl font-semibold transition-all flex items-center gap-2"
            >
              Join the Beta <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO with 4K Video — unchanged */}
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

        <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
          <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-3xl px-6 py-2 mb-8 shadow-sm">
            <Globe size={20} className="text-[#00b4d8]" />
            <span className="font-semibold text-slate-700">Farm-to-Fork • On-Chain • AI-Powered</span>
          </div>
          
          <h1 className="text-7xl md:text-8xl font-black tracking-[-4px] leading-none text-white mb-8">
            Verified.<br />
            Transparent.<br />
            Accelerating humanity.
          </h1>
          
          <p className="text-2xl text-white/90 max-w-2xl mx-auto mb-12">
            SupplierAdvisor® is the B2B &amp; B2C supply-chain platform that combines blockchain verification, real-time AI insights, and ethical transparency to make every transaction trustworthy.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/onboarding?type=business"
              className="btn-primary text-xl px-12 py-7 rounded-3xl flex items-center gap-3 text-white"
            >
              Register Your Business <ArrowRight size={24} />
            </Link>
            <Link
              href="/onboarding?type=consumer"
              className="px-12 py-7 border-2 border-white/70 hover:border-white text-xl font-medium text-white rounded-3xl flex items-center gap-3"
            >
              Shop as a Conscious Consumer
            </Link>
          </div>
        </div>
      </div>

      {/* How it Works — unchanged */}
      <div id="how-it-works" className="bg-white py-24 px-12">
        <div className="max-w-screen-2xl mx-auto">
          <h2 className="text-6xl font-black tracking-[-2px] text-center mb-6 text-[#00b4d8]">How SupplierAdvisor® Works</h2>
          <p className="text-xl text-slate-600 text-center max-w-2xl mx-auto mb-16">
            We don’t just connect buyers and sellers — we build the transparent, ethical, and efficient backbone the world needs to progress humanity.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl">1</div>
              <h3 className="text-3xl font-bold mb-3">Verify &amp; Onboard</h3>
              <p className="text-slate-600">Every business completes world-class onboarding with certificates, bank details, and location metadata. AI + human verification ensures trust from day one.</p>
            </div>
            <div className="card p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl">2</div>
              <h3 className="text-3xl font-bold mb-3">Connect &amp; Transact</h3>
              <p className="text-slate-600">Send connection requests, raise POs, ship with live GPS/IoT tracking, and mint everything on-chain. RIAD, ratings, and OTIFEF metrics are embedded in every step.</p>
            </div>
            <div className="card p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl">3</div>
              <h3 className="text-3xl font-bold mb-3">Track &amp; Improve</h3>
              <p className="text-slate-600">Consumers scan QR codes for full traceability. Businesses get AI-powered insights, risk alerts, and sustainability dashboards. Every transaction makes the world better.</p>
            </div>
          </div>
        </div>
      </div>

      {/* For Business — unchanged */}
      <div id="for-business" className="py-24 px-12 bg-[#f8fafc]">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid md:grid-cols-12 gap-16 items-center">
            <div className="md:col-span-5">
              <div className="sticky top-8">
                <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-3xl mb-6">
                  <Factory className="text-[#00b4d8]" size={28} />
                  <span className="font-bold text-xl">For Business</span>
                </div>
                <h2 className="text-6xl font-black tracking-[-2px] leading-none mb-8">
                  The most powerful supply-chain operating system ever built
                </h2>
                <p className="text-2xl text-slate-600">From verified suppliers to on-chain POs and live logistics — SupplierAdvisor® gives you total visibility, trust, and speed.</p>
                <Link href="/onboarding?type=business" className="btn-primary inline-flex mt-12 text-xl px-10 py-6">
                  Register Your Business <ArrowRight className="ml-3" />
                </Link>
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="card p-12 text-xl space-y-10">
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

      {/* For Consumers — unchanged */}
      <div id="for-consumers" className="py-24 px-12 bg-white">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid md:grid-cols-12 gap-16 items-center">
            <div className="md:col-span-7">
              <div className="card p-12 text-xl space-y-10">
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
                <h2 className="text-6xl font-black tracking-[-2px] leading-none mb-8">
                  Shop with total confidence and real impact
                </h2>
                <p className="text-2xl text-slate-600">Every purchase you make is traceable, ethical, and contributes to a better world.</p>
                <Link href="/onboarding?type=consumer" className="btn-primary inline-flex mt-12 text-xl px-10 py-6">
                  Join as a Conscious Consumer <ArrowRight className="ml-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA — unchanged */}
      <div className="bg-slate-900 text-white py-24 px-12 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl font-black tracking-[-2px] mb-6">The future of supply chains is here.</h2>
          <p className="text-2xl mb-12">Join the movement that makes transparency the standard and ethics the competitive advantage.</p>
          <button onClick={login} className="px-16 py-7 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl text-2xl font-semibold inline-flex items-center gap-4">
            Get started in under 5 minutes <ArrowRight size={28} />
          </button>
        </div>
      </div>

      {/* NEW FOOTER — added exactly as requested, clean & minimal */}
      <footer className="bg-slate-900 text-white/70 py-12 px-12 text-center text-sm border-t border-slate-800">
        <div className="max-w-screen-2xl mx-auto">
          <div className="font-black tracking-[-0.5px] mb-3">SupplierAdvisor® 2026 ©</div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-x-8 gap-y-2 text-xs">
            <a href="mailto:connect@supplieradvisor.com" className="hover:text-white transition-colors">connect@supplieradvisor.com (for booking a beta test etc.)</a>
            <a href="tel:+27825814215" className="hover:text-white transition-colors">+27 (0) 82 581 4215</a>
            <span>21A Old Howick Road, Pietermaritzburg, KwaZulu-Natal, South Africa</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
