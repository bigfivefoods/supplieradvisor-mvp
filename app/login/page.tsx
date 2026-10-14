import Link from 'next/link';
import { ThemeToggleView } from '@/components/theme/ThemeToggleView';
import { normalizeEnabledModules } from '@/lib/business/company-modules';
import { LoginReturnQuery } from '@/components/auth/LoginReturnQuery';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';
import { ShieldCheck, Smartphone, Sparkles } from 'lucide-react';

export default function LoginPage() {
  // Signed-out module map. The client theme control must not import Privy.
  const signedOutModules = normalizeEnabledModules(null);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-sa-bg px-4 sm:px-6 py-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <ThemeToggleView enabledModules={signedOutModules} />
      </div>

      <div className="w-full max-w-md">
        <LoginReturnQuery
          logo={
            <Link href="/" className="inline-flex items-center gap-3 mb-6 sm:mb-8">
              <SaOfficialLogo title="SupplierAdvisor" className="h-12 w-auto" priority />
              <span className="sa-wordmark font-black text-2xl tracking-[-1px]">SupplierAdvisor®</span>
            </Link>
          }
          features={
            <ul className="space-y-3 text-sm text-neutral-700">
              <li className="flex gap-3 items-start">
                <Sparkles className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
                Google, Apple, or email one-time code
              </li>
              <li className="flex gap-3 items-start">
                <Smartphone className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
                Operators land on their container portal only
              </li>
              <li className="flex gap-3 items-start">
                <ShieldCheck className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
                Same login can run a company and still keep a personal SA Member wallet
              </li>
            </ul>
          }
          footer={
            <>
              <p className="text-center text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Contractors: use the email from your invitation. Customers and members: the same login
                opens SA Member. Running a company does not replace your personal wallet.
              </p>

              <p className="text-center text-sm text-neutral-500">
                New customer or member?{' '}
                {/* /me's flight lists Privy chunks. Prefetch would download them with /login. */}
                <Link
                  href="/me"
                  prefetch={false}
                  className="sa-text-brand-on-light font-medium hover:underline"
                >
                  Create a free SA Member account
                </Link>
              </p>
              <p className="text-center text-sm text-neutral-500">
                New business?{' '}
                <Link href="/join" className="sa-text-brand-on-light font-medium hover:underline">
                  Choose company or government
                </Link>
              </p>
            </>
          }
        />
      </div>
    </div>
  );
}
