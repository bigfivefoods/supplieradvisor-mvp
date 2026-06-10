'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Pricing() {
  const router = useRouter();

  return (
    <div className="pl-0 pr-12 py-12 bg-[#f8fafc]">
      <Breadcrumb />
      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Pricing</h1>
      <div className="max-w-4xl mx-auto">
        <div className="card p-12 text-center">
          <h2 className="text-4xl font-bold mb-8">Business Registration</h2>
          <p className="text-6xl font-black text-[#00b4d8]">30-day free trial</p>
          <p className="text-2xl text-slate-600 mt-4">Then R299 per company per month</p>
          <p className="text-slate-500 mt-8">Unlimited users • Full ERP • On-chain verification</p>
          <button onClick={() => router.push('/onboarding')} className="btn-primary w-full py-6 mt-12 text-2xl">
            Start 30-Day Free Trial
          </button>
        </div>
      </div>
    </div>
  );
}