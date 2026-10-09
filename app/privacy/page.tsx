import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import SiteFooter from '@/components/marketing/SiteFooter';

export const metadata = {
  title: 'Privacy Policy',
  description:
    'How SupplierAdvisor® collects, uses, and protects personal and business information on the supply-chain operating system.',
  alternates: { canonical: 'https://www.supplieradvisor.com/privacy' },
  openGraph: {
    title: 'Privacy Policy · SupplierAdvisor®',
    description: 'How SupplierAdvisor collects, uses, and protects your information.',
    url: 'https://www.supplieradvisor.com/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/sa-logo.png" alt="SupplierAdvisor" width={100} height={44} className="h-9 w-auto object-contain" />
            <span className="font-black tracking-[-1px] text-xl">SupplierAdvisor®</span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-[#00b4d8] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-[#00b4d8] mb-3">Legal</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-[-2px] text-slate-900 mb-4">
          Privacy Policy
        </h1>
        <p className="text-slate-500 mb-10">Last updated: 8 October 2026 · SupplierAdvisor® (South Africa)</p>

        <div className="prose prose-slate max-w-none space-y-8 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">1. Who we are</h2>
            <p>
              SupplierAdvisor® (“we”, “us”) operates the platform at supplieradvisor.com and related
              apps. Contact:{' '}
              <a className="text-[#00b4d8] font-semibold" href="mailto:hello@supplieradvisor.com">
                hello@supplieradvisor.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">2. Information we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account &amp; identity</strong> — name, email, phone, authentication data
                (via Privy and similar providers).
              </li>
              <li>
                <strong>Company profile</strong> — trading name, registration, addresses, industry,
                certificates, bank metadata required for verification and trade.
              </li>
              <li>
                <strong>Operational data</strong> — products, stock, orders, shipments, documents,
                team membership, ratings, and related commercial records you enter on the platform.
              </li>
              <li>
                <strong>Technical data</strong> — device, browser and operating-system family, a
                screen-width band, language, and the cookies described below, for security and to
                understand how the public site is used.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">3. How we use information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Provide company workspaces, network connections, and trade workflows.</li>
              <li>Verify businesses and reduce fraud (including third-party verification partners).</li>
              <li>Operate multi-currency pricing, inventory, logistics, and accounting features.</li>
              <li>Send service and security notices; optional product updates where permitted.</li>
              <li>Improve the platform, enforce Terms, and meet legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">4. Sharing</h2>
            <p className="mb-2">
              We do not sell personal data. We share information only as needed to run the service:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Connected companies</strong> — trading counterparties you accept may see
                agreed commercial data (e.g. POs, shared documents, names).
              </li>
              <li>
                <strong>Processors</strong> — hosting (e.g. Supabase), auth, payments, verification,
                email/SMS, and analytics under appropriate contracts.
              </li>
              <li>
                <strong>Law &amp; safety</strong> — when required by law or to protect users and the
                platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">5. Storage &amp; security</h2>
            <p>
              Data is stored with reputable cloud providers with access controls, encryption in
              transit, and company-scoped membership checks inside the product. No method of
              transmission is 100% secure; please use strong credentials and protect team access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">6. Retention</h2>
            <p>
              We retain account and trade records for as long as your organisation uses the service
              and as required for legal, tax, dispute, and audit purposes. You may request deletion
              subject to those obligations and counterparties’ legitimate interests in trade history.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">7. Your rights (POPIA-aligned)</h2>
            <p>
              Depending on applicable law (including South Africa’s POPIA), you may request access,
              correction, deletion, or restriction of personal information, and object to certain
              processing. Contact us at the email above. You may also lodge a complaint with the
              Information Regulator (South Africa) where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session security. We also set one
              first-party visitor cookie, <span className="font-semibold">sa_vid</span>, kept for
              about 180 days. It holds a random identifier, how many visits that identifier has
              made, and when the last visit was. It is not derived from your IP address. We use it
              only to tell a new visit from a returning one, and to see return frequency and how
              recently someone came back. The pages in the current visit are kept in the browser
              tab until that tab closes. We do not show a cookie banner. If your browser sends Do
              Not Track or Global Privacy Control, we do not set this cookie and we record nothing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">8A. Website visit statistics</h2>
            <p className="mb-2">
              A visit to the public site can be recorded in the same Website Insights store that
              Big Five Group uses for its investor portal. Vercel may still provide separate daily
              totals. We do not sell these records, and this site does not email, Slack, or
              otherwise alert anyone about a visit.
            </p>
            <p className="mb-2">When recording is on, a visit can include:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Organisation label, industry, size and network type</strong> — from a
                server-side lookup of the connection. We do not store the raw IP address in our
                database, cache, or logs.
              </li>
              <li>
                <strong>Coarse network location</strong> — country, region, city and timezone, from
                our hosting provider’s location headers (Vercel). This is the network’s location,
                not GPS, and not a precise position. City is the finest level we keep.
              </li>
              <li>
                <strong>Device</strong> — device type, browser, operating system, a screen-width
                band rather than exact pixels, and language.
              </li>
              <li>
                <strong>How you arrived</strong> — referrer, and UTM source, medium, campaign,
                content and term.
              </li>
              <li>
                <strong>What you did</strong> — landing page, exit page, the first pages of a
                multi-page visit, time on page, scroll depth, a PDF download’s file name, the site
                name of an outbound link, a button label on public pages, and named actions such as
                “Start free trial” and completing sign-up. Inside the signed-in app we record only
                the area you used (for example “purchasing” or “finance”), never the page address,
                record ids, company names or button text.
              </li>
              <li>
                <strong>Page speed</strong> — how quickly the page loaded and responded (Core Web
                Vitals: LCP, INP and CLS), stored per page without a visitor id.
              </li>
              <li>
                <strong>New or returning</strong> — using the visitor cookie above, including return
                frequency and recency.
              </li>
            </ul>
            <p className="mt-3">
              We do not record email addresses, names, form contents, GPS, or a raw IP address in
              these visit statistics. Do Not Track and Global Privacy Control remain the opt-out:
              when either signal is on, nothing is recorded.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">9. Children</h2>
            <p>
              The platform is intended for business and institutional users, not for children under
              18.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">10. Changes</h2>
            <p>
              We may update this policy. Material changes will be posted on this page with a revised
              date. Continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/terms" className="text-[#00b4d8] hover:underline">
            Terms of Service →
          </Link>
          <Link
            href="/cancellation-refund"
            className="text-[#00b4d8] hover:underline"
          >
            Cancellation &amp; refunds →
          </Link>
          <Link href="/" className="text-slate-500 hover:text-slate-800">
            ← Back to home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
