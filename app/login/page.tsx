import Link from 'next/link';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { LoginAuthShell } from '@/components/auth/LoginAuthShell';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';
import { ShieldCheck, Smartphone, Sparkles } from 'lucide-react';

type LoginPageProps = {
  searchParams?: {
    claimed?: string | string[];
    next?: string | string[];
    email?: string | string[];
  };
};

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const claimed = firstParam(searchParams?.claimed);
  const nextFromQuery = firstParam(searchParams?.next);
  const prefillEmail = firstParam(searchParams?.email);

  const isContractorFlow =
    nextFromQuery.startsWith('/contractor') || nextFromQuery.includes('contractor');
  const isMemberFlow = nextFromQuery.startsWith('/me');

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-sa-bg px-4 sm:px-6 py-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8 sm:mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 sm:mb-8">
            <SaOfficialLogo title="SupplierAdvisor" className="h-12 w-auto" />
            <span className="sa-wordmark font-black text-2xl tracking-[-1px]">SupplierAdvisor®</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-2">
            {isMemberFlow ? 'SA Member' : 'Welcome back'}
          </h1>
          <p className="text-neutral-600 text-sm sm:text-base px-2">
            {isContractorFlow
              ? 'Independent contractor operator portal'
              : isMemberFlow
                ? 'Create a free personal account, or sign in if you already have one'
                : 'Company workspace, or SA Member if you are a customer'}
          </p>
        </div>

        {claimed ? (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm">
            Account ready. Sign in with the same email you used for your invitation.
          </div>
        ) : null}

        {isContractorFlow && prefillEmail ? (
          <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 text-sm">
            Operator invite — sign in with <strong>{prefillEmail}</strong>
          </div>
        ) : null}

        <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-5 sm:space-y-6">
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

          <LoginAuthShell
            prefillEmail={prefillEmail || undefined}
            nextFromQuery={nextFromQuery}
          />

          <p className="text-center text-xs sm:text-sm text-neutral-500 leading-relaxed">
            Contractors: use the email from your invitation. Customers and members: the same login
            opens SA Member. Running a company does not replace your personal wallet.
          </p>

          <p className="text-center text-sm text-neutral-500">
            New customer or member?{' '}
            <Link href="/me" className="text-[#00b4d8] font-medium hover:underline">
              Create a free SA Member account
            </Link>
          </p>
          <p className="text-center text-sm text-neutral-500">
            New business?{' '}
            <Link href="/join" className="text-[#00b4d8] font-medium hover:underline">
              Choose company or government
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
