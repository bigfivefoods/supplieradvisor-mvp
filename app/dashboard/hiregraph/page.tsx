'use client';

/**
 * HireAdvisor® — hire / rental marketplace command (B2C + suppliers).
 * Commercial: 2.5% supplier + 2.5% customer on hire GMV.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Handshake,
  Loader2,
  MessageSquare,
  Package,
  Percent,
  Sparkles,
  Truck,
  UserRound,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  HiregraphPage,
  HiregraphRequired,
} from '@/components/hire/HiregraphShell';
import HiregraphSystemFlow from '@/components/hire/HiregraphSystemFlow';
import HiregraphProcessPdfButtons from '@/components/hire/HiregraphProcessPdfButtons';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import {
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

type Summary = Record<string, number | string | null | undefined>;

const SUPPLY: HubModule[] = [
  {
    href: '/dashboard/hiregraph/suppliers',
    icon: Building2,
    code: '01',
    title: 'Suppliers',
    desc: 'Owners who list gear for hire — contacts, categories, insurance.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/hiregraph/categories',
    icon: ClipboardList,
    code: '02',
    title: 'Categories',
    desc: 'Plant, vehicles, tools, events… each with different requirements.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/hiregraph/catalogue',
    icon: Package,
    code: '03',
    title: 'Catalogue',
    desc: 'Hire items — rates, deposits, stock, category rules.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
];

const DEMAND: HubModule[] = [
  {
    href: '/dashboard/hiregraph/customers',
    icon: UserRound,
    code: '04',
    title: 'Customers',
    desc: 'People renting (B2C) — ID, address, met requirements.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/hiregraph/bookings',
    icon: CalendarDays,
    code: '05',
    title: 'Bookings',
    desc: 'Hire requests with dual fee quote and requirement gaps.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/hiregraph/handover',
    icon: Truck,
    code: '06',
    title: 'Handover',
    desc: 'OUT and RETURN with condition notes and deposit release.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
];

const MONEY: HubModule[] = [
  {
    href: '/dashboard/hiregraph/settlements',
    icon: Percent,
    code: '07',
    title: 'Settlements',
    desc: `${HIRE_SUPPLIER_COMMISSION_PCT}% supplier + ${HIRE_CUSTOMER_COMMISSION_PCT}% customer on rental GMV.`,
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/hiregraph/management',
    icon: Sparkles,
    code: '08',
    title: 'Management report',
    desc: 'GMV, dual fees, open hires — A4 landscape PDF.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
];

export default function HiregraphHubPage() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/hire/hiregraph?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) setSummary(data.summary || null);
    } catch {
      /* soft */
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <HiregraphRequired>
      <HiregraphPage>
        <RelationshipHeader
          eyebrow="HireAdvisor® · rental marketplace"
          title="Hire command"
          titleAccent="B2C + suppliers"
          description={`List gear by category, rent to people, clear requirements, hand out and return. Platform earns ${HIRE_SUPPLIER_COMMISSION_PCT}% from the supplier and ${HIRE_CUSTOMER_COMMISSION_PCT}% from the customer on hire rental value — not a subscription desk.`}
        />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <HiregraphProcessPdfButtons variant="hub" />
          <Link
            href="/dashboard/messages?from=hiregraph&channel=connection"
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-100"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Hire messages
          </Link>
        </div>

        <HiregraphSystemFlow />

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        ) : (
          <HubTelemetryGrid>
            <TelemetryCard
              label="Listed items"
              value={Number(summary?.listedItems) || 0}
              hint={`${Number(summary?.itemCount) || 0} in catalogue`}
            />
            <TelemetryCard
              label="Open bookings"
              value={Number(summary?.openBookings) || 0}
              hint={`${Number(summary?.outNow) || 0} out now`}
            />
            <TelemetryCard
              label="Hire GMV"
              value={`R${Number(summary?.gmvZar || 0).toLocaleString('en-ZA')}`}
              hint="Completed rentals"
            />
            <TelemetryCard
              label="Platform fees"
              value={`R${Number(summary?.platformFeesZar || 0).toLocaleString('en-ZA')}`}
              hint={`${HIRE_SUPPLIER_COMMISSION_PCT}% + ${HIRE_CUSTOMER_COMMISSION_PCT}%`}
            />
          </HubTelemetryGrid>
        )}

        <div className="mt-8 space-y-6">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
              Supply
            </p>
            <HubModuleGrid modules={SUPPLY} />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
              Demand (B2C)
            </p>
            <HubModuleGrid modules={DEMAND} />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <Handshake className="h-3.5 w-3.5" /> Dual commission
            </p>
            <HubModuleGrid modules={MONEY} />
          </div>
        </div>
      </HiregraphPage>
    </HiregraphRequired>
  );
}
