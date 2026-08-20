'use client';

/**
 * Company projects belonged to the Projects module.
 * Keep this route for old bookmarks.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  CompanyRequired,
  BusinessPage,
} from '@/components/business/BusinessShell';

export default function CompanyProjectsRedirectPage() {
  return (
    <CompanyRequired>
      <RedirectInner />
    </CompanyRequired>
  );
}

function RedirectInner() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/projects');
  }, [router]);

  return (
    <BusinessPage>
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-sm text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        <p>
          Projects now live under the{' '}
          <strong className="text-slate-900">Projects</strong> module.
          Redirecting…
        </p>
      </div>
    </BusinessPage>
  );
}
