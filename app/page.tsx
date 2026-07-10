'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ShieldCheck,
  Users,
  Factory,
  Leaf,
  Zap,
  Globe,
  BookOpen,
  Users2,
  Award,
  Heart,
  Network,
  Package,
  Truck,
  Brain,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PublicCompany = {
  id: number;
  legal_name: string | null;
  trading_name: string | null;
  verification_status: string | null;
  verified_at: string | null;
  business_type: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  badge: 'verified' | 'network';
};

export default function LandingPage() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [verifiedCompanies, setVerifiedCompanies] = useState<PublicCompany[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [loadingVerified, setLoadingVerified] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/verified-companies', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        setVerifiedCompanies(data.companies || []);
        setVerifiedCount(data.counts?.verified ?? data.companies?.length ?? 0);
      } catch {
        if (!cancelled) setVerifiedCompanies([]);
      } finally {
        if (!cancelled) setLoadingVerified(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const goLogin = () => {
    if (ready && user) {
      router.push('/dashboard/select-company');
    } else {
      router.push('/login?next=/dashboard/select-company');
    }
  };

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

          <div className="flex items-center gap-4 md:gap-8 text-sm md:text-base font-medium flex-wrap">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[#00b4d8] transition-colors"
            >
              How it Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('verified')}
              className="hover:text-[#00b4d8] transition-colors"
            >
              Verified
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('for-business')}
              className="hover:text-[#00b4d8] transition-colors"
            >
              For Business
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('for-consumers')}
              className="hover:text-[#00b4d8] transition-colors"
            >
              For Consumers
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('for-society')}
              className="hover:text-[#00b4d8] transition-colors"
            >
              For Society
            </button>

            <button
              type="button"
              onClick={goLogin}
              className="px-6 md:px-8 py-3.5 border border-[#00b4d8] text-[#00b4d8] hover:bg-[#00b4d8]/5 rounded-3xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap touch-manipulation"
            >
              Log in
            </button>

            <button
              type="button"
              onClick={() => router.push('/onboarding?type=business')}
              className="px-6 md:px-8 py-3.5 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
            >
              Join free <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO — same structure, stronger image + micro-trust line */}
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=2560&q=80"
          alt="Modern warehouse and supply chain"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />

        <div className="relative z-10 max-w-4xl mx-auto text-center px-6 pt-32">
          <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-3xl px-6 py-2 mb-8 shadow-sm mt-5">
            <Globe size={20} className="text-[#00b4d8]" />
            <span className="font-semibold text-slate-700">
              Farm-to-Fork • On-Chain • AI-Powered
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[-4px] leading-none text-white mb-8">
            Verified.
            <br />
            Transparent.
            <br />
            Accelerating humanity.
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-5">
            SupplierAdvisor® is the B2B, B2G &amp; B2C supply-chain platform that combines blockchain
            verification, real-time intelligence, and ethical transparency so every transaction is
            trustworthy.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pb-3">
            <Link
              href="/onboarding?type=business"
              className="btn-primary text-lg md:text-xl px-10 py-6 rounded-3xl flex items-center gap-3 text-white justify-center"
            >
              Register Your Business <ArrowRight size={24} />
            </Link>
            <Link
              href="/onboarding?type=consumer"
              className="px-10 py-6 border-2 border-white/70 hover:border-white text-lg md:text-xl font-medium text-white rounded-3xl flex items-center gap-3 justify-center"
            >
              Shop as a Conscious Consumer
            </Link>
          </div>
          <p className="text-sm text-white/75 mt-2">
            Free to join · company workspace in minutes · no card required for beta
          </p>
        </div>
      </div>

      {/* How it Works */}
      <div id="how-it-works" className="bg-white py-12 sm:py-16 md:py-24 px-6 md:px-12">
        <div className="max-w-screen-2xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] text-center mb-6 text-[#00b4d8]">
            How SupplierAdvisor® Works
          </h2>
          <p className="text-lg md:text-xl text-slate-600 text-center max-w-2xl mx-auto mb-12 md:mb-16">
            We don’t just connect buyers and sellers — we build the transparent, ethical backbone
            for trade and operations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="card p-6 md:p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl font-black text-[#00b4d8]">
                1
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">Verify company</h3>
              <p className="text-slate-600">
                Complete onboarding with company identity, certificates, and location. Verification
                builds trust from day one across the network.
              </p>
            </div>
            <div className="card p-6 md:p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl font-black text-[#00b4d8]">
                2
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">Connect &amp; trade</h3>
              <p className="text-slate-600">
                Request connections, agree pricing, raise POs (standard or on-chain escrow), and
                share documents with counterparties you trust.
              </p>
            </div>
            <div className="card p-6 md:p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-4xl font-black text-[#00b4d8]">
                3
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">Operate &amp; prove</h3>
              <p className="text-slate-600">
                Run inventory, manufacturing, and distribution with OTIFEF, ratings, live tracking,
                Super-Cube® leadership, and AI-assisted insights.
              </p>
            </div>
          </div>

          {/* Product map — light chips, same design language */}
          <div className="mt-12 flex flex-wrap justify-center gap-2 md:gap-3">
            {[
              { icon: Network, label: 'Network' },
              { icon: Truck, label: 'Buy / Sell' },
              { icon: Package, label: 'Inventory' },
              { icon: Factory, label: 'Manufacturing' },
              { icon: Globe, label: 'Distribution' },
              { icon: Brain, label: 'Intelligence' },
            ].map((item) => (
              <div
                key={item.label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <item.icon className="w-4 h-4 text-[#00b4d8]" />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why join — conversion band */}
      <div id="why-join" className="bg-[#f8fafc] py-12 sm:py-16 md:py-20 px-6 md:px-12 border-t border-slate-100">
        <div className="max-w-screen-2xl mx-auto">
          <div className="card p-8 md:p-12 !bg-white">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#00b4d8]/10 text-[#0077b6] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                  Why join
                </div>
                <h2 className="text-3xl md:text-5xl font-black tracking-[-2px] text-slate-900 mb-4">
                  Your company OS for verified trade
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-6">
                  One workspace for network, buying and selling, inventory, production, shipping, and
                  intelligence — so trust and operations live in the same place.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Verified counterparties and measurable OTIFEF performance',
                    'Multi-company accounts for groups that own several brands',
                    'On-chain options when capital or pedigree must be proven',
                  ].map((t) => (
                    <li key={t} className="flex gap-3 text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/onboarding?type=business"
                  className="btn-primary !py-4 !px-8 text-base inline-flex items-center gap-2"
                >
                  Create free company workspace <ArrowRight size={20} />
                </Link>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {
                    d: 'Day 1',
                    t: 'Profile & team',
                    b: 'Register company, invite teammates, complete verification path.',
                  },
                  {
                    d: 'Day 2',
                    t: 'Connect',
                    b: 'Discover or invite a supplier or customer and accept the handshake.',
                  },
                  {
                    d: 'Day 3',
                    t: 'Trade & operate',
                    b: 'Raise a PO, list stock, or plan a shipment — live in one system.',
                  },
                ].map((card) => (
                  <div
                    key={card.d}
                    className="rounded-3xl border border-slate-200 bg-[#f8fafc] p-5"
                  >
                    <div className="text-xs font-black uppercase tracking-widest text-[#00b4d8] mb-2">
                      {card.d}
                    </div>
                    <div className="font-bold text-lg text-slate-900 mb-2">{card.t}</div>
                    <p className="text-sm text-slate-600 leading-relaxed">{card.b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Companies */}
      <div id="verified" className="bg-white py-16 px-6 md:px-12 border-t border-slate-100">
        <div className="max-w-screen-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-5 py-2 rounded-3xl mb-4 text-sm font-semibold">
              <ShieldCheck size={18} /> TRUSTED &amp; VERIFIED
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-[-2px] mb-4">
              Businesses on SupplierAdvisor®
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              {verifiedCount > 0
                ? `${verifiedCount}+ verified and network companies building transparent trade together`
                : 'Companies building transparent, ethical trade on the platform'}
            </p>
          </div>

          {loadingVerified ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-3xl p-8 bg-slate-50 animate-pulse h-48"
                />
              ))}
            </div>
          ) : verifiedCompanies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {verifiedCompanies.map((company) => {
                const name =
                  company.trading_name || company.legal_name || `Company #${company.id}`;
                const sub =
                  company.trading_name && company.legal_name && company.trading_name !== company.legal_name
                    ? company.legal_name
                    : null;
                const meta = [company.industry || company.business_type, company.city, company.country]
                  .filter(Boolean)
                  .join(' · ');
                const isVerified = company.badge === 'verified';
                return (
                  <div
                    key={company.id}
                    className="border border-slate-200 rounded-3xl p-8 hover:shadow-lg transition-all bg-white"
                  >
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-2xl text-slate-900 truncate">{name}</h3>
                        {sub && <p className="text-slate-600 truncate">{sub}</p>}
                      </div>
                      <span
                        className={`px-4 py-1.5 rounded-2xl text-sm font-semibold whitespace-nowrap shrink-0 ${
                          isVerified
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {isVerified ? '✓ Verified' : 'On network'}
                      </span>
                    </div>

                    <div className="text-sm text-slate-600 mb-4 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#00b4d8] shrink-0" />
                      <span className="truncate">{meta || 'Business on SupplierAdvisor'}</span>
                    </div>

                    <p className="text-slate-700 line-clamp-3 mb-4 min-h-[60px]">
                      {isVerified
                        ? 'Verified business committed to transparency, ethical practices, and quality across the supply chain.'
                        : 'Active company workspace on SupplierAdvisor — trading identity live on the network.'}
                    </p>

                    {company.verified_at && (
                      <p className="text-xs text-emerald-600 font-medium">
                        Verified on{' '}
                        {new Date(company.verified_at).toLocaleDateString('en-ZA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 bg-[#f8fafc]">
              <ShieldCheck className="w-10 h-10 text-[#00b4d8] mx-auto mb-3" />
              <p className="text-slate-600 font-medium mb-2">Be among the first verified businesses</p>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                Complete company onboarding and verification — your trading name can appear here for
                the network to discover.
              </p>
              <Link href="/onboarding?type=business" className="btn-primary !py-3 !px-8 text-sm">
                Register your business
              </Link>
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-2 text-[#00b4d8] font-semibold hover:underline"
            >
              Join the verified network <ArrowRight size={18} />
            </Link>
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
                  <div>
                    <strong>Scan product passports</strong> — See verified journey and pedigree where
                    brands publish QR / GS1 identity.
                  </div>
                </div>
                <div className="flex gap-6">
                  <Users className="text-amber-500 flex-shrink-0" size={32} />
                  <div>
                    <strong>Support ethical brands</strong> — Prefer verified, high-rated businesses
                    with transparent reviews.
                  </div>
                </div>
                <div className="flex gap-6">
                  <Leaf className="text-[#00b4d8] flex-shrink-0" size={32} />
                  <div>
                    <strong>Real impact</strong> — Purchases that favour regenerative and fair
                    practices across the chain.
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-5">
              <div className="sticky top-8">
                <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-3xl mb-6 border border-slate-100">
                  <Leaf className="text-[#00b4d8]" size={28} />
                  <span className="font-bold text-xl">For Consumers</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] leading-none mb-8">
                  Shop with total confidence and real impact
                </h2>
                <p className="text-xl md:text-2xl text-slate-600">
                  Every purchase you make is more transparent, ethical, and tied to a better world.
                </p>
                <Link
                  href="/onboarding?type=consumer"
                  className="btn-primary inline-flex mt-12 text-xl px-10 py-6"
                >
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
                <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-3xl mb-6 border border-slate-100">
                  <Factory className="text-[#00b4d8]" size={28} />
                  <span className="font-bold text-xl">For Business</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] leading-none mb-8">
                  The supply-chain operating system built for trust
                </h2>
                <p className="text-xl md:text-2xl text-slate-600">
                  From verified suppliers to multi-currency trade and live logistics —
                  SupplierAdvisor® gives you visibility, trust, and speed.
                </p>
                <Link
                  href="/onboarding?type=business"
                  className="btn-primary inline-flex mt-12 text-xl px-10 py-6"
                >
                  Register Your Business <ArrowRight className="ml-3" />
                </Link>
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="card p-6 sm:p-8 md:p-12 text-base md:text-lg space-y-10">
                <div className="flex gap-6">
                  <ShieldCheck className="text-emerald-500 flex-shrink-0" size={32} />
                  <div>
                    <strong>Verified ecosystem</strong> — Counterparties complete company onboarding
                    and verification so you trade with real entities.
                  </div>
                </div>
                <div className="flex gap-6">
                  <Zap className="text-amber-500 flex-shrink-0" size={32} />
                  <div>
                    <strong>AI + on-chain intelligence</strong> — Insights, OTIFEF performance, and
                    optional escrow when capital must be locked.
                  </div>
                </div>
                <div className="flex gap-6">
                  <Truck className="text-[#00b4d8] flex-shrink-0" size={32} />
                  <div>
                    <strong>End-to-end operations</strong> — Inventory, manufacturing, distribution,
                    Incoterms, and proof-of-delivery in one company workspace.
                  </div>
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
            <div className="inline-flex items-center gap-2 bg-[#f8fafc] px-5 py-2 rounded-3xl mb-6 border border-slate-100">
              <Users2 className="text-[#00b4d8]" size={28} />
              <span className="font-bold text-xl">For Society</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-[-2px] mb-4">
              Governments • Schools • Associations
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              SupplierAdvisor® empowers institutions and groups to operate with transparency,
              intelligence, and impact.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="card p-6 sm:p-8 md:p-12 group">
              <BookOpen className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Government &amp; Public Sector</h3>
              <p className="text-slate-600 mb-8">
                Run transparent procurement, improve service visibility, and use leadership and RIAD
                tools to support better decisions.
              </p>
              <Link
                href="/onboarding?type=government"
                className="text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all mt-8"
              >
                Register as a Government Entity <ArrowRight size={18} />
              </Link>
            </div>

            <div className="card p-6 sm:p-8 md:p-12 group">
              <Users className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Schools &amp; Educational Institutions</h3>
              <p className="text-slate-600 mb-8">
                Track spend on nutrition and supplies with stronger traceability and accountability
                for outcomes that matter.
              </p>
              <Link
                href="/onboarding?type=school"
                className="text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all mt-8"
              >
                Register Your School <ArrowRight size={18} />
              </Link>
            </div>

            <div className="card p-6 sm:p-8 md:p-12 group">
              <Users2 className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Associations, Cooperatives &amp; Groups</h3>
              <p className="text-slate-600 mb-8">
                Consolidate members on one platform. Unlock shared metrics, benchmarking, and
                collective bargaining power.
              </p>
              <Link
                href="/onboarding?type=association"
                className="text-[#00b4d8] font-medium flex items-center gap-2 group-hover:gap-3 transition-all mt-8"
              >
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
            <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-3xl mb-6 border border-slate-100">
              <Heart className="text-[#00b4d8]" size={28} />
              <span className="font-bold text-xl">For Humanity</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-[-2px] leading-none mb-6 text-[#00b4d8]">
              One Platform.
              <br />
              One Purpose.
            </h2>
            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto">
              SupplierAdvisor® unites ethical sourcing, world-class leadership development, and AI
              intelligence to advance a more just, sustainable world.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="card p-6 sm:p-8 md:p-12 group">
              <Globe className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Ethical Sourcing &amp; UN SDGs</h3>
              <p className="text-slate-600 mb-8">
                Transparent supply chains support goals from Zero Hunger and Responsible Consumption
                to Climate Action and Strong Institutions.
              </p>
            </div>

            <div className="card p-6 sm:p-8 md:p-12 group">
              <Award className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">Super-Cube® Leadership</h3>
              <p className="text-slate-600 mb-8">
                Built on Dr. Craig R. Muller’s doctoral Super-Cube® model — assessments and practice
                that improve leaders and everyone around them.
              </p>
            </div>

            <div className="card p-6 sm:p-8 md:p-12 group">
              <Zap className="text-[#00b4d8] text-5xl mb-8" />
              <h3 className="text-3xl font-bold mb-4">A Better World Together</h3>
              <p className="text-slate-600 mb-8">
                When governments, businesses, schools, associations, and conscious consumers unite on
                one verified platform, collective intelligence accelerates real progress.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-slate-900 text-white py-12 sm:py-16 md:py-24 px-6 md:px-12 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black tracking-[-2px] mb-6">
            The future of supply chains is here.
          </h2>
          <p className="text-xl md:text-2xl mb-12">
            Join the movement that makes transparency the standard and ethics the competitive
            advantage.
          </p>
          <button
            type="button"
            onClick={() => router.push('/onboarding?type=business')}
            className="px-12 md:px-16 py-6 md:py-7 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl text-xl md:text-2xl font-semibold inline-flex items-center gap-4 touch-manipulation"
          >
            Get started in under 5 minutes <ArrowRight size={28} />
          </button>
          <p className="text-sm text-white/50 mt-6">
            Free company workspace ·{' '}
            <Link href="/terms" className="underline hover:text-white">
              Terms
            </Link>{' '}
            ·{' '}
            <Link href="/privacy" className="underline hover:text-white">
              Privacy
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white/70 py-12 px-6 text-center text-sm border-t border-slate-800">
        <div className="max-w-screen-2xl mx-auto">
          <div className="font-black tracking-[-0.5px] mb-4 text-white/90">
            SupplierAdvisor® 2026 ©
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-x-8 gap-y-2 text-xs">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <a
              href="mailto:connect@supplieradvisor.com"
              className="hover:text-white transition-colors"
            >
              connect@supplieradvisor.com
            </a>
            <a href="tel:+27825814215" className="hover:text-white transition-colors">
              +27 (0) 82 581 4215
            </a>
            <span>South Africa</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
