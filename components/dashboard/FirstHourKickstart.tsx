'use client';

/**
 * First-hour empty state + first-trade loop for new tenants.
 * - Cold start: profile → partner → PO/quote → rate
 * - Has partners but no trade docs: 3-step discover → document → bill/rate
 */
import Link from 'next/link';
import {
  Building2,
  Network,
  ShoppingCart,
  Star,
  ArrowRight,
  Sparkles,
  FileText,
  Route,
} from 'lucide-react';

export type FirstHourSignals = {
  networkAccepted?: number;
  openPos?: number;
  products?: number;
  profileCompleteness?: number;
  quotesOpen?: number;
  /** Optional: open invoices (draft/sent) if dashboard has the KPI */
  invoicesOpen?: number;
  loading?: boolean;
};

function isColdStart(s: FirstHourSignals): boolean {
  if (s.loading) return false;
  const net = s.networkAccepted ?? 0;
  const pos = s.openPos ?? 0;
  const products = s.products ?? 0;
  const quotes = s.quotesOpen ?? 0;
  const completeness = s.profileCompleteness ?? 0;
  // Cold if almost no trade graph activity
  return net + pos + quotes === 0 && (products < 3 || completeness < 70);
}

/** Partners exist but the golden trade path has not started */
function isFirstTradeReady(s: FirstHourSignals): boolean {
  if (s.loading || isColdStart(s)) return false;
  const net = s.networkAccepted ?? 0;
  const pos = s.openPos ?? 0;
  const quotes = s.quotesOpen ?? 0;
  const inv = s.invoicesOpen ?? 0;
  return net > 0 && pos + quotes + inv === 0;
}

const COLD_STEPS = [
  {
    id: 'profile',
    title: 'Complete company profile',
    body: 'Trading name, industry, and location unlock discovery.',
    href: '/dashboard/my-business/profile',
    cta: 'Edit profile',
    icon: Building2,
    accent: 'from-sky-500 to-cyan-600',
  },
  {
    id: 'partner',
    title: 'Invite your first partner',
    body: 'Connect a supplier or customer to open the network.',
    href: '/dashboard/suppliers/add',
    cta: 'Invite partner',
    icon: Network,
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'trade',
    title: 'Create first PO or quote',
    body: 'One real trade document starts the trust loop.',
    href: '/dashboard/suppliers/po',
    cta: 'New PO',
    icon: ShoppingCart,
    accent: 'from-violet-500 to-indigo-600',
  },
  {
    id: 'rate',
    title: 'Rate a partner',
    body: 'Peer stars + OTIFEF build verified trust.',
    href: '/dashboard/suppliers/ratings',
    cta: 'Rate now',
    icon: Star,
    accent: 'from-amber-500 to-orange-600',
  },
] as const;

const TRADE_STEPS = [
  {
    id: 'raise',
    title: 'Raise a PO or quote',
    body: 'Buyer: send a purchase order. Seller: send a quote to a connected partner.',
    href: '/dashboard/suppliers/po',
    cta: 'Create PO',
    secondaryHref: '/dashboard/customers/quotes',
    secondaryCta: 'New quote',
    icon: ShoppingCart,
    accent: 'from-violet-500 to-indigo-600',
  },
  {
    id: 'invoice',
    title: 'Invoice from the PO',
    body: 'Seller: accept inbound PO → Create invoice from PO → Email / WhatsApp PDF.',
    href: '/dashboard/customers/orders?tab=inbound',
    cta: 'Inbound POs',
    secondaryHref: '/dashboard/customers/invoices',
    secondaryCta: 'Invoices',
    icon: FileText,
    accent: 'from-sky-500 to-cyan-600',
  },
  {
    id: 'close',
    title: 'Receive, pay, rate',
    body: 'Capture OTIFEF on delivery, mark paid (with payment ref), then peer rate.',
    href: '/dashboard/suppliers/po',
    cta: 'Receive + OTIFEF',
    secondaryHref: '/dashboard/suppliers/ratings',
    secondaryCta: 'Rate partner',
    icon: Star,
    accent: 'from-amber-500 to-orange-600',
  },
] as const;

export default function FirstHourKickstart(signals: FirstHourSignals) {
  if (isColdStart(signals)) {
    return (
      <Panel
        title="Your first hour on SupplierAdvisor"
        body="Command center is live — seed it with profile, partners, and one trade so ratings and OTIFEF can kick in."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLD_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.id}
                href={step.href}
                className="group flex flex-col rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm hover:border-sky-200 hover:shadow-md transition-all touch-manipulation"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {i + 1}
                  </span>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${step.accent} text-white`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-bold text-sm text-slate-900 group-hover:text-[#0077b6]">
                  {step.title}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed flex-1">
                  {step.body}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#00b4d8] group-hover:text-[#0077b6]">
                  {step.cta}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            );
          })}
        </div>
        <FooterLinks />
      </Panel>
    );
  }

  if (isFirstTradeReady(signals)) {
    return (
      <Panel
        title="Run your first trade loop"
        body="You’re connected — close the loop: PO/quote → invoice → receive & rate. One complete path builds trust scores."
        iconRoute
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TRADE_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className="flex flex-col rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Step {i + 1}
                  </span>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${step.accent} text-white`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-bold text-sm text-slate-900">{step.title}</div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed flex-1">
                  {step.body}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#00b4d8] hover:bg-[#0096c7] rounded-full px-3 py-1.5"
                  >
                    {step.cta}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  {step.secondaryHref ? (
                    <Link
                      href={step.secondaryHref}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 bg-sky-50 border border-sky-100 rounded-full px-3 py-1.5 hover:bg-sky-100"
                    >
                      {step.secondaryCta}
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <FooterLinks />
      </Panel>
    );
  }

  return null;
}

function Panel({
  title,
  body,
  children,
  iconRoute,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  iconRoute?: boolean;
}) {
  return (
    <div className="mb-6 rounded-2xl sm:rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 sm:p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          {iconRoute ? (
            <Route className="w-5 h-5" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
            {body}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

function FooterLinks() {
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-xs">
      <Link
        href="/dashboard/guide/golden-path"
        className="font-bold text-sky-700 hover:underline"
      >
        Full golden-path walkthrough →
      </Link>
      <Link
        href="/dashboard/customers/ar"
        className="font-semibold text-slate-500 hover:text-slate-800"
      >
        AR aging
      </Link>
      <Link
        href="/dashboard/my-business/billing"
        className="font-semibold text-slate-500 hover:text-slate-800"
      >
        Billing & founding free
      </Link>
    </div>
  );
}
