'use client';

import CompanyFieldVerify, {
  type FieldVerifySnapshot,
} from '@/components/business/CompanyFieldVerify';
import TrustBadges from '@/components/business/TrustBadges';
import {
  CUSTOMER_PRICES,
  customerPriceFor,
  formatCustomerZar,
} from '@/lib/verifynow/prices';

type PriceId = keyof typeof CUSTOMER_PRICES;

function product(id: PriceId) {
  const price = CUSTOMER_PRICES[id];
  return {
    id: price.id,
    label: price.label,
    guideName: price.label,
    credits: price.credits,
    priceExclVatZar: price.costExclVatZar,
    priceLabel: formatCustomerZar(price.zar),
    customerZar: price.zar,
    customerCents: price.cents,
    customerPriceLabel: formatCustomerZar(price.zar),
  };
}

const standardCatalogue = [
  product('cipc_company_match'),
  product('cipc_director_search'),
  product('said_verification'),
  product('bank_account'),
  product('aml_pep'),
];

const capitecCatalogue = [
  product('cipc_company_match'),
  product('cipc_director_search'),
  product('said_verification'),
  product('business_bank_account'),
  product('aml_pep'),
];

const bundle = customerPriceFor('supplier_bundle', false);
const at = '2026-10-14T09:30:00.000Z';

function shell(
  checks: FieldVerifySnapshot['checks'],
  asyncBank = false
): FieldVerifySnapshot {
  const price = customerPriceFor('supplier_bundle', asyncBank);
  return {
    configured: true,
    canRun: true,
    mode: 'production',
    checks,
    disabledReason: null,
    directVatCheck: false,
    vatNote:
      'VerifyNow has no direct VAT check. SupplierAdvisor® cross-checks the profile VAT number against VAT numbers returned on a CIPC Director Search, when the registry includes them.',
    supplierBundleNote:
      'VerifyNow exposes the Supplier Bundle in the dashboard, not as one public API call. SupplierAdvisor® runs the component checks and stores one combined summary.',
    supplierBundle: {
      availableAsSingleApi: false,
      priceLabel: formatCustomerZar(price.zar),
      credits: price.credits,
      customerZar: price.zar,
      customerCents: price.cents,
      customerPriceLabel: formatCustomerZar(price.zar),
      listZar: price.listZar,
    },
    checksCatalogue: asyncBank ? capitecCatalogue : standardCatalogue,
    asyncBank,
  };
}

const empty = shell({});

const verified = shell({
  cipc_company_match: {
    check: 'cipc_company_match',
    status: 'match',
    source: 'verifynow',
    checked_at: at,
    matches: {
      name: 'match',
      status: 'match',
      address: 'match',
      directors: 'match',
    },
    paystack_reference: 'sa-vn-cipc_company_match-42-1710000001',
    amount_zar: 69,
    payment_status: 'paid',
  },
  cipc_director_search: {
    check: 'cipc_director_search',
    status: 'match',
    source: 'verifynow',
    checked_at: at,
    subject_masked: '•••••••••9087',
    matches: { vat: 'match' },
    paystack_reference: 'sa-vn-cipc_director_search-42-1710000002',
    amount_zar: 69,
    payment_status: 'paid',
  },
  said_verification: {
    check: 'said_verification',
    status: 'verified',
    source: 'verifynow',
    checked_at: at,
    subject_masked: '•••••••••9087',
    paystack_reference: 'sa-vn-said_verification-42-1710000003',
    amount_zar: 15,
    payment_status: 'paid',
  },
  aml_pep: {
    check: 'aml_pep',
    status: 'clear',
    source: 'verifynow',
    checked_at: at,
    paystack_reference: 'sa-vn-aml_pep-42-1710000004',
    amount_zar: 15,
    payment_status: 'paid',
  },
  bank_account: {
    check: 'bank_account',
    status: 'verified',
    source: 'verifynow',
    checked_at: at,
    subject_masked: '•••• 7890',
    matches: {
      account_open: 'match',
      holder: 'match',
      accepts_debits: 'match',
      accepts_credits: 'match',
    },
    paystack_reference: 'sa-vn-bank_account-42-1710000005',
    amount_zar: 50,
    payment_status: 'paid',
  },
  supplier_bundle: {
    check: 'supplier_bundle',
    status: 'match',
    source: 'verifynow',
    checked_at: at,
    paystack_reference: 'sa-vn-supplier_bundle-42-1710000006',
    amount_zar: bundle.zar,
    payment_status: 'paid',
  },
});

const capitec = shell({}, true);

const FIELDS = [
  ['Legal name', 'name'],
  ['Registration no. (CIPC)', 'registration'],
  ['VAT number', 'vat'],
  ['Street address', 'address'],
  ['Primary contact', 'contact'],
  ['Director SA ID', 'director'],
  ['Account number', 'bank'],
] as const;

function FieldCard({
  title,
  focus,
  companyId,
  snapshot,
}: {
  title: string;
  focus: (typeof FIELDS)[number][1];
  companyId: number;
  snapshot: FieldVerifySnapshot;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 h-10 rounded-xl border border-neutral-200 bg-neutral-50" />
      <CompanyFieldVerify
        companyId={companyId}
        email="review@supplieradvisor.com"
        focus={focus}
        initialSnapshot={snapshot}
      />
    </section>
  );
}

export default function PreviewBoard() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#0077b6]">
          SupplierAdvisor® review preview
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">VerifyNow on the company profile</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Sample data only. These are the confirmed VAT-inclusive Paystack prices. A check runs
          after payment is verified. Email, phone and website have no VerifyNow product, so they
          are not charged.
        </p>
      </header>

      <section className="space-y-3" id="before-payment">
        <h2 className="text-lg font-semibold text-slate-900">Verify buttons, before payment</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map(([title, focus]) => (
            <FieldCard
              key={focus}
              title={title}
              focus={focus}
              companyId={9101}
              snapshot={empty}
            />
          ))}
          <FieldCard title="Capitec Business account" focus="bank" companyId={9103} snapshot={capitec} />
        </div>
      </section>

      <section className="space-y-3" id="verified">
        <h2 className="text-lg font-semibold text-slate-900">Verified badges, after payment</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map(([title, focus]) => (
            <FieldCard
              key={focus}
              title={title}
              focus={focus}
              companyId={9102}
              snapshot={verified}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3" id="public-badge">
        <h2 className="text-lg font-semibold text-slate-900">Public supplier badge</h2>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="mb-2 text-sm text-slate-600">Shown on the public company page. No raw ID or account data.</p>
          <TrustBadges
            verificationStatus="verified"
            bankVerificationStatus="verified"
            supplierTrust={{ status: 'verified', checkedAt: at }}
          />
        </div>
      </section>
    </main>
  );
}
