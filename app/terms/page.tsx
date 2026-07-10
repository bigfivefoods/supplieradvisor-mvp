import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service · SupplierAdvisor®',
  description: 'Terms governing use of the SupplierAdvisor platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/sa-logo.png" alt="SupplierAdvisor" width={40} height={40} className="rounded-2xl" />
            <span className="font-black tracking-[-1px] text-xl">SupplierAdvisor®</span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-[#00b4d8] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-[#00b4d8] mb-3">Legal</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-[-2px] text-slate-900 mb-4">
          Terms of Service
        </h1>
        <p className="text-slate-500 mb-10">Last updated: 10 July 2026 · SupplierAdvisor® (South Africa)</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">1. Agreement</h2>
            <p>
              By accessing or using SupplierAdvisor® (the “Platform”), you agree to these Terms and
              our{' '}
              <Link href="/privacy" className="text-[#00b4d8] font-semibold hover:underline">
                Privacy Policy
              </Link>
              . If you use the Platform on behalf of a company, you represent that you have authority
              to bind that company.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">2. The Platform</h2>
            <p>
              SupplierAdvisor provides software tools for company onboarding, network connections,
              procurement and sales workflows, inventory, manufacturing and distribution operations,
              finance visibility, intelligence, and related features. Features may be in beta and
              change over time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">3. Accounts &amp; companies</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must provide accurate information and keep credentials secure.</li>
              <li>
                Workspaces are company-scoped. Owners and admins control team access and roles.
              </li>
              <li>
                You are responsible for activity under your accounts and for members you invite.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">4. Not a party to your trades</h2>
            <p>
              Unless expressly stated for a specific product (e.g. optional on-chain escrow),
              SupplierAdvisor is a technology platform. We are not the buyer, seller, carrier, or
              guarantor of commercial contracts between users. Verification badges and trust scores
              support diligence; they are not a warranty of counterparty performance or legality of
              goods.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">5. Acceptable use</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Misrepresent identity, company status, certifications, or goods.</li>
              <li>Use the Platform for illegal trade, fraud, spam, or abuse of other users.</li>
              <li>Attempt to breach security, scrape without permission, or reverse-engineer the service.</li>
              <li>Upload malware or content that infringes others’ rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">6. Content &amp; data</h2>
            <p>
              You retain rights to data you upload. You grant us a licence to host, process, and
              display that data as needed to operate the Platform and features you enable (including
              sharing with companies you connect to). You warrant you have rights to the data you
              upload.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">7. Payments &amp; third parties</h2>
            <p>
              Payment, verification, messaging, and blockchain networks may be provided by third
              parties under their terms. On-chain transactions are irreversible once confirmed; you
              are responsible for wallet security and network fees.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">8. Intellectual property</h2>
            <p>
              The Platform, branding, Super-Cube® leadership model presentation on the service, and
              software are owned by SupplierAdvisor or its licensors. You may not copy or resell the
              Platform except as permitted by these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">9. Disclaimers</h2>
            <p>
              THE PLATFORM IS PROVIDED “AS IS” AND “AS AVAILABLE” TO THE MAXIMUM EXTENT PERMITTED BY
              LAW. WE DISCLAIM IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, AND NON-INFRINGEMENT. We do not guarantee uninterrupted service or that data
              will be error-free.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">10. Liability</h2>
            <p>
              To the maximum extent permitted by law, SupplierAdvisor and its officers are not
              liable for indirect, incidental, special, consequential, or punitive damages, or lost
              profits, arising from use of the Platform. Our aggregate liability for claims relating
              to the Platform is limited to fees you paid us for the service in the three months
              before the claim (or ZAR 1,000 if no fees were paid), except where liability cannot be
              limited by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">11. Suspension &amp; termination</h2>
            <p>
              We may suspend or terminate access for breach, risk, or legal reasons. You may stop
              using the Platform at any time. Provisions that by nature should survive (IP,
              liability, indemnity) will survive termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">12. Governing law</h2>
            <p>
              These Terms are governed by the laws of the Republic of South Africa. Courts of South
              Africa have exclusive jurisdiction, subject to mandatory consumer protections where
              they apply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">13. Contact</h2>
            <p>
              Questions:{' '}
              <a className="text-[#00b4d8] font-semibold" href="mailto:connect@supplieradvisor.com">
                connect@supplieradvisor.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/privacy" className="text-[#00b4d8] hover:underline">
            Privacy Policy →
          </Link>
          <Link href="/" className="text-slate-500 hover:text-slate-800">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
