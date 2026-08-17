'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  Globe,
  Loader2,
  Megaphone,
  Nfc,
  Package,
  ShoppingBag,
  Store,
  Users,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import { formatZar } from '@/lib/b2c/member-account-types';
import { AdvisorBillingClarityCard } from '@/components/services/AdvisorBillingClarityCard';
import RetailgraphSystemFlow from '@/components/retail/RetailgraphSystemFlow';

type Summary = {
  skuCount: number;
  customerCount: number;
  salesToday: number;
  takingsTodayZar: number;
  openTills: number;
};

export default function RetailgraphHubPage() {
  const companyId = getSelectedCompanyId();
  const { withAuthJson } = useApiAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ summary?: Summary }>(
      `/api/retail/retailgraph?companyId=${companyId}`
    );
    setSummary(data.summary || null);
  }, [companyId, withAuthJson]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  return (
    <RetailgraphRequired>
      <RetailgraphPage
        title="Retail till OS"
        description="Ring up sales, present QR or NFC for the customer to pay on their phone, and collect open SA Member bills at the counter. Same pay-at-till path works on GymAdvisor and clinic desks."
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
          </div>
        ) : (
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <Stat label="SKUs" value={String(summary?.skuCount || 0)} />
            <Stat label="Sales today" value={String(summary?.salesToday || 0)} />
            <Stat
              label="Takings today"
              value={formatZar(summary?.takingsTodayZar || 0)}
            />
            <Stat label="Open tills" value={String(summary?.openTills || 0)} />
          </div>
        )}

        <RetailgraphSystemFlow defaultCollapsed={false} />

        <div className="mb-6">
          <AdvisorBillingClarityCard
            brand="your store"
            moduleLabel="RetailAdvisor®"
            accountsHref="/dashboard/retailgraph/accounts"
            accentClass="border-orange-200 bg-orange-50/70 dark:border-orange-800 dark:bg-orange-950/30"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <HubCard
            href="/dashboard/retailgraph/till"
            icon={Nfc}
            title="Till"
            desc="Basket, cash, or present QR / NFC so the customer pays on their phone."
          />
          <HubCard
            href="/dashboard/retailgraph/catalogue"
            icon={Package}
            title="Catalogue"
            desc="Till SKUs with prices — tap to add on the till."
          />
          <HubCard
            href="/dashboard/retailgraph/sales"
            icon={ShoppingBag}
            title="Sales"
            desc="Paid baskets and how they were collected."
          />
          <HubCard
            href="/dashboard/retailgraph/customers"
            icon={Users}
            title="Customers"
            desc="Walk-in book — link to SA Member when they scan."
          />
          <HubCard
            href="/dashboard/retailgraph/accounts"
            icon={Banknote}
            title="Accounts"
            desc="Store credit and bills — present at till like other Advisors."
          />
          <HubCard
            href="/dashboard/retailgraph/comms"
            icon={Megaphone}
            title="Comms"
            desc="Ads and notices to shoppers on SA Member."
          />
          <HubCard
            href="/dashboard/retailgraph/website"
            icon={Globe}
            title="Website"
            desc="SA Member QR, public shop page, and embed for your site."
          />
          <HubCard
            href="/me"
            icon={Store}
            title="SA Member"
            desc="Customers install the free app, then tap or scan to pay."
          />
        </div>
      </RetailgraphPage>
    </RetailgraphRequired>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-orange-800">
        {label}
      </p>
      <p className="text-xl font-black tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function HubCard({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: typeof Store;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-300"
    >
      <Icon className="h-5 w-5 text-orange-600" />
      <h2 className="mt-2 font-black text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{desc}</p>
    </Link>
  );
}
