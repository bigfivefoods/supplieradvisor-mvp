'use client';

/**
 * SP entry for inviting wholesalers — same business invite as the rest of the platform.
 * Deep-links to /dashboard/invite-business with relationship=supplier.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  CompanyRequired,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function SpWholesalersRedirectPage() {
  return (
    <CompanyRequired>
      <Redirect />
    </CompanyRequired>
  );
}

function Redirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(
      '/dashboard/invite-business?type=supplier&from=nsnp-sp'
    );
  }, [router]);
  return (
    <SchoolsPage>
      <div className="py-24 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">
          Opening business invite…
        </p>
      </div>
    </SchoolsPage>
  );
}
