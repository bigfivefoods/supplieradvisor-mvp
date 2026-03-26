'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, Truck, Users, Factory, Leaf } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';

export default function LandingPage() {
  const { login } = usePrivy();

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Top Navigation – previous design preserved */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-12 py-5 flex items-center justify-between">
          {/* SA Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00b4d8] rounded-3xl flex items-center justify-center text-white font-black text-4xl leading-none pt-0.5">S</div>
            <div className="text-3xl font-black tracking-[-2px]">SupplierAdvisor</div>
          </div>

          {/* Menu */}
          <div className="flex items-center gap-10 text-lg font-medium">
            <button
              onClick={scrollToHowItWorks}
              className="hover:text-[#00b4d8] transition-colors"
            >
              How it Works
            </button>
            <Link href="/onboarding?type=business" className="hover:text-[#00b4d8] transition-colors">
              For Business
            </Link>
            <Link href="/onboarding?type=consumer" className="hover:text-[#00b4d8] transition-colors">
              For Consumers
            </Link>
            <button
              onClick={login}
              className="px-8 py-3.5 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl font-semibold transition-all flex items-center gap-2"
            >
              Join the Beta <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero – previous design preserved */}
      <div className="pt-32 pb-24 px-12 max-w-screen-2xl mx-auto">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-7xl font-black tracking-[-3px] leading-none mb-6">
            Verified. Transparent.<br />Efficient.
          </h1>
          <p className="text-2xl text-slate-600 mb-10">
            The B2B &amp; B2C supply-chain platform that connects verified businesses and conscious consumers with real-time, on-chain traceability.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/onboarding?type=business"
              className="btn-primary text-xl px-10 py-6 rounded-3xl flex items-center gap-3"
            >
              Register your Business <ArrowRight />
            </Link>
            <Link
              href="/onboarding?type=consumer"
              className="px-10 py-6 border-2 border-slate-300 hover:border-slate-400 rounded-3xl text-xl font-medium flex items-center gap-3"
            >
              Shop as a Consumer
            </Link>
          </div>
        </div>
      </div>

      {/* How it Works Section – exactly as requested */}
      <div id="how-it-works" className="bg-white py-24 px-12">
        <div className="max-w-screen-2xl mx-auto">
          <h2 className="text-6xl font-black tracking-[-2px] text-center mb-16 text-[#00b4d8]">
            How SupplierAdvisor Works
          </h2>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* B2B */}
            <div className="card p-12">
              <div className="flex items-center gap-4 mb-8">
                <Factory size={42} className="text-[#00b4d8]" />
                <h3 className="text-4xl font-black">For Business (B2B)</h3>
              </div>
              <ul className="space-y-8 text-xl">
                <li className="flex gap-4">
                  <ShieldCheck className="text-emerald-500 mt-1" size={28} />
                  <div><strong>Verified suppliers &amp; buyers</strong> — full onboarding with certificates, bank details, VAT, and metadata.</div>
                </li>
                <li className="flex gap-4">
                  <Truck className="text-[#00b4d8] mt-1" size={28} />
                  <div><strong>End-to-end on-chain traceability</strong> — POs, invoices, shipments, CoA, live GPS tracking, and OTIFEF metrics.</div>
                </li>
                <li className="flex gap-4">
                  <Users className="text-amber-500 mt-1" size={28} />
                  <div><strong>AI-powered matching + RIAD</strong> — smart search, connection requests, performance scorecards, and embedded Risks/Issues/Actions/Decisions.</div>
                </li>
              </ul>
              <Link href="/onboarding?type=business" className="btn-primary w-full mt-12 py-6 text-xl">
                Register your Business →
              </Link>
            </div>

            {/* B2C */}
            <div className="card p-12">
              <div className="flex items-center gap-4 mb-8">
                <Leaf size={42} className="text-[#00b4d8]" />
                <h3 className="text-4xl font-black">For Consumers (B2C)</h3>
              </div>
              <ul className="space-y-8 text-xl">
                <li className="flex gap-4">
                  <ShieldCheck className="text-emerald-500 mt-1" size={28} />
                  <div><strong>Scan any QR code</strong> — instantly see the full verified chain of custody and ethical ratings.</div>
                </li>
                <li className="flex gap-4">
                  <Users className="text-amber-500 mt-1" size={28} />
                  <div><strong>Support ethical brands</strong> — shop directly from verified farms and manufacturers with transparent reviews.</div>
                </li>
                <li className="flex gap-4">
                  <Truck className="text-[#00b4d8] mt-1" size={28} />
                  <div><strong>Live delivery tracking</strong> — real-time proof-of-delivery on-chain.</div>
                </li>
              </ul>
              <Link href="/onboarding?type=consumer" className="btn-primary w-full mt-12 py-6 text-xl">
                Join as a Conscious Consumer →
              </Link>
            </div>
          </div>

          <p className="text-center text-slate-500 mt-16 max-w-2xl mx-auto text-lg">
            SupplierAdvisor accelerates ethical and efficient supply chains by combining world-class verification, real-time on-chain data, and AI-driven insights — making trust the new competitive advantage from farm to fork.
          </p>
        </div>
      </div>

      {/* Simple footer teaser */}
      <div className="bg-slate-900 text-white py-12 text-center">
        <p className="text-2xl font-medium">Ready to build the most trusted supply chain in Africa and beyond?</p>
        <button onClick={login} className="mt-8 px-12 py-5 bg-[#00b4d8] rounded-3xl text-xl font-semibold">
          Get started in under 5 minutes
        </button>
      </div>
    </div>
  );
}
