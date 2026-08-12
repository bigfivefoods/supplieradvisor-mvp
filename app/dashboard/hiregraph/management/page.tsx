'use client';

import Link from 'next/link';
import { FileDown } from 'lucide-react';
import {
  HiregraphPage,
  HiregraphRequired,
} from '@/components/hire/HiregraphShell';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import { HIREGRAPH_PROCESS_GUIDE_LANDSCAPE_HREF } from '@/lib/hire/hiregraph-process-guide-links';
import ManagementReportPanel from '@/components/advisors/ManagementReportPanel';
import {
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

export default function HiregraphManagementPage() {
  return (
    <HiregraphRequired>
      <HiregraphPage>
        <div className="mb-4">
          <Link
            href="/dashboard/hiregraph"
            className="text-xs font-bold text-violet-700 dark:text-violet-300"
          >
            ← HireAdvisor
          </Link>
        </div>
        <RelationshipHeader
          eyebrow="HireAdvisor® · Insights"
          title="Management report"
          titleAccent="hire GMV pack"
          description={`Open hires, category mix, and dual commission (${HIRE_SUPPLIER_COMMISSION_PCT}% + ${HIRE_CUSTOMER_COMMISSION_PCT}%) — A4 landscape PDF.`}
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <a
            href={HIREGRAPH_PROCESS_GUIDE_LANDSCAPE_HREF}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-800 dark:bg-gradient-to-r dark:from-violet-500 dark:to-cyan-400 dark:text-slate-950"
          >
            <FileDown className="h-3.5 w-3.5" /> Process PDF · landscape
          </a>
        </div>

        <ManagementReportPanel advisor="hiregraph" />
      </HiregraphPage>
    </HiregraphRequired>
  );
}
