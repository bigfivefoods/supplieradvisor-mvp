'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ChevronRight } from 'lucide-react';
import { setSelectedCompanyId } from '@/lib/containers/company';
import { defaultHomePathForRole } from '@/lib/business/permissions';

export type B2cBusinessCard = {
  id: number;
  name: string;
  role?: string | null;
};

function openCompany(biz: B2cBusinessCard, router: ReturnType<typeof useRouter>) {
  setSelectedCompanyId(biz.id, { name: biz.name });
  try {
    localStorage.setItem('saWorkspace', 'business');
    window.dispatchEvent(new Event('sa:company-changed'));
  } catch {
    /* private mode */
  }
  router.push(defaultHomePathForRole(biz.role));
}

export function B2cWorkspaceSwitch({
  hasBusiness,
  businesses,
  variant = 'card',
}: {
  hasBusiness: boolean;
  businesses: B2cBusinessCard[];
  variant?: 'card' | 'header';
}) {
  const router = useRouter();
  const list = businesses;

  if (variant === 'header') {
    if (!hasBusiness) return null;
    return (
      <Link
        href="/dashboard/select-company"
        className="rounded-full bg-white/15 p-2 text-white"
        aria-label="Switch to a company workspace"
        title="Switch to business"
      >
        <Building2 className="h-4 w-4" />
      </Link>
    );
  }

  if (!hasBusiness) {
    return (
      <Link
        href="/join"
        className="flex items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <Building2 className="h-5 w-5 text-slate-400" />
        <span>
          <span className="block text-sm font-black text-slate-900 dark:text-white">
            Also run a company?
          </span>
          <span className="block text-[11px] text-slate-500 dark:text-neutral-400">
            Register a business — this personal wallet stays yours
          </span>
        </span>
      </Link>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-neutral-800">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-sky-600">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            Switch to business
          </p>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
            Same login. Pick a company — it will not mix into this personal
            wallet.
          </p>
        </div>
      </div>
      {list.length > 0 ? (
        <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
          {list.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => openCompany(b, router)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-neutral-800"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
                    {b.name}
                  </span>
                  {b.role ? (
                    <span className="block text-[11px] capitalize text-slate-500 dark:text-neutral-400">
                      {b.role.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-bold text-[#0077b6]">Open</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Link
          href="/dashboard/select-company"
          className="flex items-center justify-between px-4 py-3 text-sm font-bold text-[#0077b6]"
        >
          Choose a company
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
      <Link
        href="/dashboard/select-company"
        className="block border-t border-slate-100 px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 dark:border-neutral-800 dark:text-neutral-400"
      >
        All workspaces
      </Link>
    </section>
  );
}
