'use client';

import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, ShieldCheck, Truck, Users, Award, Leaf } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  const { login } = usePrivy();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b z-50">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#00b4d8] rounded-2xl flex items-center justify-center text-white font-black text-2xl">S</div>
            <div className="text-3xl font-black tracking-[-2px]">SupplierAdvisor</div>
          </div>

          <div className="flex items-center gap-10 text-lg font-medium">
            <a href="#how" className="hover:text-[#00b4d8] transition">How it Works</a>
            <a href="#for-business" className="hover:text-[#00b4d8] transition">For Business</a>
            <a href="#for-consumer" className="hover:text-[#00b4d8] transition">For Consumers</a>
            <a href="#features" className="hover:text-[#00b4d8] transition">Features</a>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={login} className="px-8 py-3 font-medium rounded-3xl border border-slate-300 hover:bg-slate-100 transition">Log in</button>
            <Link href="/onboarding" className="btn-primary flex items-center gap-3 px-8 py-3">
              Get Started <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-24 bg-gradient-to-br from-white via-[#f0f9ff] to-white">
        <div className="max-w-screen-2xl mx-auto px-8 text-center">
          <div className="inline-flex items-center gap-3 bg-white border border-slate-200 rounded-full px-6 py-2 mb-8">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-emerald-600">Beta now open – 1,247 businesses already joined</span>
          </div>

          <h1 className="text-7xl md:text-8xl font-black tracking-[-4px] leading-none mb-6">
            Supply chains you can <span className="text-[#00b4d8]">actually trust</span>.
          </h1>
          <p className="max-w-3xl mx-auto text-2xl text-slate-600 mb-12">
            Verified businesses & consumers. On-chain transparency. Real-time tracking.<br />
            From farm to fork — built like Tesla, powered like SpaceX.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link href="/onboarding?type=business" className="btn-primary text-xl py-7 px-16 rounded-3xl flex items-center gap-4 group">
              I’m a Business <ArrowRight className="group-hover:translate-x-1 transition" />
            </Link>
            <Link href="/onboarding?type=consumer" className="bg-white hover:bg-slate-50 border-2 border-slate-900 text-xl py-7 px-16 rounded-3xl flex items-center gap-4 group transition">
              I’m a Consumer <ArrowRight className="group-hover:translate-x-1 transition" />
            </Link>
          </div>

          <div className="mt-12 text-sm text-slate-500 flex items-center justify-center gap-8">
            <div>🔒 Bank-level verification</div>
            <div>⛓️ On-chain records</div>
            <div>📍 Live tracking</div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="border-b bg-white py-6">
        <div className="max-w-screen-2xl mx-auto px-8 flex flex-wrap justify-center gap-x-16 gap-y-6 opacity-75">
          <div className="text-2xl font-semibold">Woolworths</div>
          <div className="text-2xl font-semibold">Pick n Pay</div>
          <div className="text-2xl font-semibold">Shoprite</div>
          <div className="text-2xl font-semibold">Checkers</div>
          <div className="text-2xl font-semibold">Spar</div>
        </div>
      </div>

      {/* FOR BUSINESS */}
      <section id="for-business" className="py-24 bg-white">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block bg-[#00b4d8] text-white text-sm font-medium px-6 py-2 rounded-3xl mb-6">FOR BUSINESSES</div>
              <h2 className="text-6xl font-black tracking-[-2px] leading-none mb-8">Find verified suppliers in seconds.<br />Transact with total confidence.</h2>
              <ul className="space-y-6 text-xl">
                <li className="flex gap-4"><ShieldCheck className="text-[#00b4d8] mt-1" /> Instant certificate verification & expiry alerts</li>
                <li className="flex gap-4"><Truck className="text-[#00b4d8] mt-1" /> Live OTIFEF tracking + on-chain PO records</li>
                <li className="flex gap-4"><Award className="text-[#00b4d8] mt-1" /> Trusted rating & review system</li>
                <li className="flex gap-4"><Leaf className="text-[#00b4d8] mt-1" /> Sustainability & BEE compliance built-in</li>
              </ul>
              <Link href="/onboarding?type=business" className="btn-primary inline-flex items-center gap-3 mt-12 text-xl py-6 px-12 rounded-3xl">
                Join as a Business <ArrowRight />
              </Link>
            </div>
            <div className="bg-slate-100 rounded-3xl aspect-video flex items-center justify-center text-8xl">📦</div>
          </div>
        </div>
      </section>

      {/* FOR CONSUMERS */}
      <section id="for-consumer" className="py-24 bg-[#f8fafc]">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="bg-slate-100 rounded-3xl aspect-video flex items-center justify-center text-8xl">🛒</div>
            <div>
              <div className="inline-block bg-[#00b4d8] text-white text-sm font-medium px-6 py-2 rounded-3xl mb-6">FOR CONSUMERS</div>
              <h2 className="text-6xl font-black tracking-[-2px] leading-none mb-8">Know exactly where your food comes from.<br />Shop with total peace of mind.</h2>
              <ul className="space-y-6 text-xl">
                <li className="flex gap-4"><ShieldCheck className="text-[#00b4d8] mt-1" /> Scan any product → see full verified journey</li>
                <li className="flex gap-4"><Users className="text-[#00b4d8] mt-1" /> Connect directly with ethical farms & brands</li>
                <li className="flex gap-4"><Leaf className="text-[#00b4d8] mt-1" /> Carbon footprint & sustainability scores</li>
              </ul>
              <Link href="/onboarding?type=consumer" className="btn-primary inline-flex items-center gap-3 mt-12 text-xl py-6 px-12 rounded-3xl">
                Join as a Consumer <ArrowRight />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-screen-2xl mx-auto px-8 text-center">
          <h2 className="text-5xl font-black tracking-[-2px] mb-6">Built for the entire supply chain</h2>
          <p className="text-2xl text-slate-600 max-w-2xl mx-auto">Everything you need in one beautiful platform.</p>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {[
              { icon: '🔍', title: 'Deep Verified Search', desc: 'Find suppliers by certificate, location, rating, or product type' },
              { icon: '📦', title: 'Raise POs Instantly', desc: 'Digital purchase orders with auto-verified details' },
              { icon: '📍', title: 'Live Tracking', desc: 'Real-time logistics, OTIFEF metrics, and alerts' },
              { icon: '⭐', title: 'Ratings & Reviews', desc: 'Transparent trust scores for every business' },
              { icon: '⛓️', title: 'On-Chain Records', desc: 'Immutable proof of every transaction' },
              { icon: '🛡️', title: 'Risk & Expiry Alerts', desc: 'Never miss a certificate expiry again' },
            ].map((f, i) => (
              <div key={i} className="card text-left">
                <div className="text-6xl mb-6">{f.icon}</div>
                <h3 className="text-3xl font-bold mb-4">{f.title}</h3>
                <p className="text-lg text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-[#00b4d8] text-white text-center">
        <div className="max-w-screen-2xl mx-auto px-8">
          <h2 className="text-6xl font-black tracking-[-2px] mb-8">Ready to join the most trusted supply chain network in Africa?</h2>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/onboarding?type=business" className="bg-white text-slate-900 text-2xl py-8 px-20 rounded-3xl font-semibold hover:scale-105 transition">I’m a Business – Join Now</Link>
            <Link href="/onboarding?type=consumer" className="border-2 border-white text-2xl py-8 px-20 rounded-3xl font-semibold hover:bg-white hover:text-[#00b4d8] transition">I’m a Consumer – Join Now</Link>
          </div>
          <p className="mt-8 text-white/80">Beta access is free for the first 3 months. No credit card required.</p>
        </div>
      </section>

      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-screen-2xl mx-auto px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-8 h-8 bg-[#00b4d8] rounded-2xl flex items-center justify-center text-white font-black">S</div>
            <div className="text-3xl font-black">SupplierAdvisor</div>
          </div>
          <p className="text-slate-400">Farm to Fork. Verified. On-chain.</p>
          <div className="mt-12 text-slate-500 text-sm">© 2026 SupplierAdvisor. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}