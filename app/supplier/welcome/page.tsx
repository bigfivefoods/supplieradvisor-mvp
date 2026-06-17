'use client';

import Link from 'next/link';
import { CheckCircle, ArrowRight, Package, FileText, User } from 'lucide-react';

export default function SupplierWelcome() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="w-10 h-10 text-emerald-600" />
      </div>

      <h1 className="font-black text-5xl tracking-[-1.5px]">Welcome to SupplierAdvisor!</h1>
      <p className="text-2xl text-neutral-600 mt-4">
        Your supplier profile has been activated.
      </p>

      <div className="my-10 text-left bg-white rounded-3xl border border-neutral-200 p-8">
        <h2 className="font-semibold text-xl mb-6">What happens next?</h2>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="mt-1">
              <Package className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <div>
              <p className="font-medium">You’ll receive Purchase Orders</p>
              <p className="text-sm text-neutral-600 mt-1">
                When a buyer creates a PO with your company, you’ll get notified by email.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="mt-1">
              <FileText className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <div>
              <p className="font-medium">Complete your full profile (Recommended)</p>
              <p className="text-sm text-neutral-600 mt-1">
                Add your products, certifications, full banking details, and logo to increase visibility and trust.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="mt-1">
              <User className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <div>
              <p className="font-medium">Access your Supplier Dashboard</p>
              <p className="text-sm text-neutral-600 mt-1">
                View and manage all POs, update your information, and track performance.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/dashboard"
          className="btn-primary flex items-center justify-center gap-3 px-8 py-4 text-lg"
        >
          Go to My Dashboard <ArrowRight className="w-5 h-5" />
        </Link>

        <Link
          href="/supplier/profile"
          className="flex items-center justify-center gap-3 px-8 py-4 text-lg border border-neutral-300 rounded-3xl hover:bg-neutral-50 transition-colors"
        >
          Complete Full Profile
        </Link>
      </div>

      <p className="text-sm text-neutral-500 mt-8">
        Thank you for joining. We’re excited to work with you.
      </p>
    </div>
  );
}