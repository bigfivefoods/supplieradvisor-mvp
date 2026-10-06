import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import LandingNav from '@/components/marketing/LandingNav';
import HeroAudienceStage from '@/components/marketing/HeroAudienceStage';
import HomeBelowFoldLazy from '@/components/marketing/HomeBelowFoldLazy';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';

export const metadata: Metadata = {
  description:
    'SupplierAdvisor® is the supply-chain OS for verified trade, industry workflows, and SA Member accounts with a 30-day free trial.',
};

/**
 * Brief 10 + 89: first HTML stays server-rendered marketing copy and keeps
 * heavy product UI in a client island via HomeBelowFoldLazy (ssr:false).
 */
export default function LandingPage() {
  return (
    <div className="relative z-0 min-h-dvh bg-sa-bg text-sa-text antialiased selection:bg-cyan-100 dark:selection:bg-cyan-500/30">
      <LandingNav />
      <HeroAudienceStage />
      <main>
        <section className="border-b border-slate-200 bg-white px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-10">
          <div className="mx-auto grid w-full max-w-screen-2xl gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#00b4d8]">
                SupplierAdvisor®
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                One operating system for verified trade, operations, and member experiences.
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-700">
                SupplierAdvisor brings your supplier network, customer relationships, inventory movement,
                production commitments, quality evidence, and financial controls into a single workspace.
                Teams stop stitching together disconnected spreadsheets and messages. Instead, planners,
                buyers, operators, and leaders work from one live process view where every update can be
                traced, approved, and explained.
              </p>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
                The home page introduces the complete commercial model in plain language: companies run the
                Core OS for B2B and B2G execution, then add industry packs when domain depth matters.
                Consumers and patients use SA Member with the same identity fabric, so businesses keep one
                account graph while serving very different audiences. This gives operators confidence that
                daily actions, compliance records, and customer moments are connected instead of trapped in
                separate tools.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/join"
                  className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#0096c7]"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/industries"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Explore industries
                </Link>
                <Link
                  href="/me"
                  className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-6 py-3 text-sm font-bold text-[#0077b6] transition hover:bg-sky-100"
                >
                  Create free SA Member account
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-[#f8fafc] p-6 sm:p-8">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Why teams switch</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
                <li>One verified network for suppliers, customers, and partner companies.</li>
                <li>Orders, receipts, lots, and invoices remain tied to the same chain of proof.</li>
                <li>Quality, SHEQ, and corrective actions sit next to financial impact.</li>
                <li>Industry workflows can be added without breaking core governance.</li>
                <li>Member-facing journeys run on the same trust and identity layer.</li>
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-slate-600">
                Start with a {COMPANY_TRIAL_DAYS}-day free trial, invite your full team, and pressure-test the
                system against real procurement, fulfilment, and customer journeys before you commit.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
          <div className="mx-auto max-w-screen-2xl space-y-5 text-slate-700">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Core OS in practical language
            </h2>
            <p className="max-w-5xl text-base leading-relaxed">
              Core OS means every company starts with the same dependable backbone. Network keeps the map of
              approved counterparties and relationships. Supplier and customer records are structured so
              onboarding, risk checks, and ongoing scorecards happen in the same place your teams transact.
              Inventory and operations then use those same records to move stock from purchase through
              production to delivery without re-keying identifiers or hunting for old approvals. Quality,
              SHEQ, and projects live inside that operating path so incidents, non-conformances, and
              improvements are linked to real orders, real costs, and real people. Finance closes the loop by
              pairing source events with invoicing, payments, and audit evidence. Intelligence surfaces the
              trends leaders ask for without forcing analysts to rebuild context every week.
            </p>
            <p className="max-w-5xl text-base leading-relaxed">
              This structure matters because supply-chain execution is never one team. Sales promises dates,
              procurement confirms supply, planners allocate, operations produce, dispatch ships, finance
              reconciles, and leadership needs trust in all of it. When each step happens in separate apps,
              people become the integration layer and risk grows quietly. SupplierAdvisor keeps the process on
              one fabric so handoffs are visible and recoverable. If a lot is held, the commercial and
              service impacts are already in context. If a shipment is delayed, customer, supplier, and
              internal teams can see one truth instead of arguing over snapshots.
            </p>
            <p className="max-w-5xl text-base leading-relaxed">
              The platform is intentionally designed for African trade realities. Teams often need local
              billing support, blended online and offline communication, and clear proof for auditors,
              regulators, and counterparties. SupplierAdvisor serves those needs while still feeling modern and
              fast enough for frontline work. Operators can execute quickly, managers can verify quickly, and
              executives can make decisions from current information rather than month-end reconstructions.
            </p>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-[#f8fafc] px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
          <div className="mx-auto grid max-w-screen-2xl gap-8 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-black text-slate-900">For private companies</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Run B2B trade loops from quote to invoice with one company fee and unlimited users. Keep
                procurement, operations, quality, and finance aligned without purchasing separate stacks.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-black text-slate-900">For public programmes</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Support transparent programme execution with role-based process paths, clear supplier evidence,
                and reporting that is easier to explain across departments and delivery partners.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-black text-slate-900">For consumers and patients</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                SA Member gives people one free wallet for bookings, check-ins, family access, payments, and
                proofs. Companies keep their operational graph while people keep personal control.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
          <div className="mx-auto max-w-screen-2xl">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Industry depth lives on dedicated pages
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-relaxed text-slate-700">
              Home focuses on the core commercial story. Detailed industry workflows are available on dedicated
              pages so buyers can evaluate exactly the Advisor they need. Explore agriculture and food flows,
              quarry and construction operations, apparel and manufacturing requirements, service diaries,
              clinic pathways, hire transactions, and retail journeys through the industry catalogue.
            </p>
            <p className="mt-4 max-w-4xl text-base leading-relaxed text-slate-600">
              Start with the full index, then open specific pages for examples such as{' '}
              <Link href="/industries/fitness-gyms" className="font-bold text-[#0077b6] underline">
                GymAdvisor®
              </Link>
              ,{' '}
              <Link href="/industries/medical-practices" className="font-bold text-[#0077b6] underline">
                Medical practices
              </Link>
              ,{' '}
              <Link href="/industries/hire-rental" className="font-bold text-[#0077b6] underline">
                HireAdvisor®
              </Link>
              , and{' '}
              <Link href="/industries/retail-shop" className="font-bold text-[#0077b6] underline">
                RetailAdvisor®
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
          <div className="mx-auto max-w-screen-2xl">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Keep one identity from personal wallet to company operator
            </h2>
            <p className="mt-4 max-w-5xl text-base leading-relaxed text-slate-700">
              SupplierAdvisor is built as one graph, not two disconnected products. That means the same person
              can use SA Member for personal interactions and still transition into a company role without
              creating duplicate identities. For businesses, this reduces support overhead and improves trust,
              because member activity and company workflows can be connected only when appropriate permissions
              exist. For consumers and patients, the value is simplicity: one account for bookings, check-ins,
              family profiles, and proofs, with clear control over personal details.
            </p>
            <p className="mt-4 max-w-5xl text-base leading-relaxed text-slate-600">
              The result is a practical commercial advantage. Operators gain better visibility into demand and
              service quality, while customers get faster, clearer service. This is especially useful for
              hybrids like clinics, gyms, and hire desks where internal operations and customer touchpoints are
              tightly linked. You can introduce member experiences without standing up a separate app stack,
              separate identity provider, or separate reporting pathway.
            </p>
            <p className="mt-6 text-base font-semibold text-slate-800">
              Ready to test it with your own team and customers? Start the {COMPANY_TRIAL_DAYS}-day free trial,
              then use /pricing for plan details and referral economics.
            </p>
          </div>
        </section>
      </main>
      <HomeBelowFoldLazy />
    </div>
  );
}
