'use client';

/**
 * Packaging is merged into Company → Modules.
 * Keep this route as a redirect for old bookmarks and emails.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  CompanyRequired,
  BusinessPage,
} from '@/components/business/BusinessShell';

export default function PackagingRedirectPage() {
  return (
    <CompanyRequired>
      <RedirectInner />
    </CompanyRequired>
  );
}

function RedirectInner() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/my-business/modules');
  }, [router]);

  return (
    <BusinessPage>
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-sm text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        <p>
          Packaging now lives under{' '}
          <strong className="text-slate-900">Company → Modules</strong>.
          Redirecting…
        </p>
      </div>
    </BusinessPage>
  );
}
