import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Cancellation & Refund Policy',
  description:
    'How to cancel SupplierAdvisor® platform subscriptions and when refunds apply — company SaaS only; practice and trade fees stay off-platform.',
  alternates: {
    canonical: 'https://www.supplieradvisor.com/cancellation-refund',
  },
  openGraph: {
    title: 'Cancellation & Refund Policy · SupplierAdvisor®',
    description:
      'Cancel platform subscriptions and understand refund rules for SupplierAdvisor company plans.',
    url: 'https://www.supplieradvisor.com/cancellation-refund',
  },
};

export default function CancellationRefundPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={100}
              height={44}
              className="h-9 w-auto object-contain"
            />
            <span className="font-black tracking-[-1px] text-xl">
              SupplierAdvisor®
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-[#00b4d8] inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-[#00b4d8] mb-3">
          Legal
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-[-2px] text-slate-900 mb-4">
          Cancellation &amp; Refund Policy
        </h1>
        <p className="text-slate-500 mb-10">
          Last updated: 11 August 2026 · SupplierAdvisor® (South Africa)
        </p>

        <div className="space-y-8 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              1. What this policy covers
            </h2>
            <p className="mb-2">
              This policy applies to <strong>SupplierAdvisor® platform fees</strong>{' '}
              only — the company SaaS subscription (and related prepaid platform
              plans) you pay us so your organisation can use the Platform.
            </p>
            <p>
              It does <strong>not</strong> cover money that never flows through
              SupplierAdvisor, including: gym or clinic member/patient fees;
              goods or services you buy or sell with trading partners; logistics
              or carrier charges; or any fees you set inside FitAdvisor®, clinic
              Advisors, or other vertical modules. Those arrangements stay
              between you and your customers or suppliers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              2. Free trial
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Where a free trial is offered (e.g. 30 days), you may cancel at
                any time during the trial without a platform subscription charge
                for that trial period.
              </li>
              <li>
                If you do not cancel before the trial ends and a paid plan is
                required to continue, billing may start as described at checkout
                or in-app Billing.
              </li>
              <li>
                Cancel during the trial from{' '}
                <strong>Dashboard → My business → Billing</strong> (or by emailing
                us — see Contact).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              3. Cancelling a paid subscription
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                You may cancel a recurring platform subscription at any time.
                Cancellation stops <strong>future</strong> renewals.
              </li>
              <li>
                Access typically continues until the end of the paid period
                already purchased (unless we agree otherwise or terminate for
                breach under our{' '}
                <Link
                  href="/terms"
                  className="text-[#00b4d8] font-semibold hover:underline"
                >
                  Terms of Service
                </Link>
                ).
              </li>
              <li>
                How to cancel: use in-app Billing where available, or email{' '}
                <a
                  className="text-[#00b4d8] font-semibold"
                  href="mailto:hello@supplieradvisor.com"
                >
                  hello@supplieradvisor.com
                </a>{' '}
                from an account admin address with your company name and the
                email on the account.
              </li>
              <li>
                We will confirm cancellation by email when processed. Keep the
                confirmation for your records.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              4. Refunds — monthly plans
            </h2>
            <p className="mb-2">
              Monthly platform subscriptions are generally billed in advance for
              the month.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Cooling-off / good-faith review.</strong> If you cancel
                within <strong>7 days</strong> of the first paid charge for a new
                monthly subscription and have not made material productive use of
                paid features (for example, only exploratory setup), you may
                request a full refund of that first charge.
              </li>
              <li>
                After that window, or after material use of the paid service,
                monthly fees are <strong>non-refundable</strong> for the current
                period. Cancellation prevents the next renewal.
              </li>
              <li>
                Duplicate or accidental charges (e.g. double billing due to a
                technical error) are refundable once verified.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              5. Refunds — prepaid and multi-year plans
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Prepaid multi-month or multi-year platform plans are sold at a
                discount because they are committed terms.
              </li>
              <li>
                Unless required by law or expressly stated at purchase: prepaid
                amounts are <strong>not pro-rated for early cancellation</strong>{' '}
                after the first 7 days of the prepaid term (same good-faith
                review as monthly for brand-new first-time prepaid purchases).
              </li>
              <li>
                If we permanently discontinue the Platform and cannot provide a
                reasonable substitute, we may refund a fair portion of unused
                prepaid time at our discretion or as required by law.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              6. How refunds are paid
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Approved refunds are returned to the original payment method
                (e.g. card via Paystack) where possible.
              </li>
              <li>
                Bank or card networks may take several business days to show the
                credit after we process the refund.
              </li>
              <li>
                Refunds are issued in the currency charged (typically ZAR for
                South African billing) unless the payment provider requires
                otherwise.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              7. What we do not refund
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Third-party costs (identity verification, SMS, blockchain network
                fees, payment-provider fees not reversed by the provider).
              </li>
              <li>
                Commercial payments between you and your buyers, suppliers,
                members, patients, or other users — SupplierAdvisor is not the
                merchant of those trades.
              </li>
              <li>
                Periods of suspended access resulting from your breach of the
                Terms, fraud, or illegal use.
              </li>
              <li>
                Services already fully delivered (for example, a completed paid
                onboarding or one-off professional service we invoice separately,
                unless that invoice states otherwise).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              8. Chargebacks and payment disputes
            </h2>
            <p>
              Please contact us before raising a chargeback so we can resolve the
              issue quickly. Unwarranted chargebacks may lead to account review
              or suspension. If a payment is reversed by the bank or processor,
              we may suspend access until the account is current. Referral or
              partner payouts tied to a reversed payment may be voided (see Terms
              on supply-chain referral fees).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              9. Changes to plans and pricing
            </h2>
            <p>
              We may change plan features or pricing for future periods. Material
              changes will be communicated through the site or account notices.
              Price changes do not retroactively alter a prepaid term already
              paid, except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              10. South African law and consumer rights
            </h2>
            <p>
              SupplierAdvisor is primarily a business-to-business platform. Where
              mandatory consumer or other protections under South African law
              apply to you, those rights are not excluded by this policy. This
              policy is intended to explain our commercial refund practice for
              platform subscriptions; it sits alongside our Terms of Service and
              Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">11. Contact</h2>
            <p>
              Cancellation or refund requests:{' '}
              <a
                className="text-[#00b4d8] font-semibold"
                href="mailto:hello@supplieradvisor.com"
              >
                hello@supplieradvisor.com
              </a>
              . Include company name, billing email, approximate payment date,
              and reason for the request. We aim to respond within 5 business
              days.
            </p>
            <p className="mt-2">
              Phone (South Africa):{' '}
              <a
                className="text-[#00b4d8] font-semibold"
                href="tel:+27825814215"
              >
                +27 (0) 82 581 4215
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">12. Changes</h2>
            <p>
              We may update this policy. The date at the top of this page will
              change when we do. Continued use of the Platform after posting
              means you accept the updated policy for future charges, subject to
              any rights you already have for periods already paid.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-4 text-sm font-semibold">
          <Link
            href="/terms"
            className="text-[#00b4d8] hover:underline"
          >
            Terms of Service →
          </Link>
          <Link
            href="/privacy"
            className="text-[#00b4d8] hover:underline"
          >
            Privacy Policy →
          </Link>
          <Link href="/" className="text-slate-500 hover:text-slate-800">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
