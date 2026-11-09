/**
 * SARS programmatic VAT201 submission.
 *
 * There is no public API. The only sanctioned route is the Independent
 * Software Vendor (ISV) interface, and SupplierAdvisor® is not accredited.
 * This flag stays off. Nothing in this file opens a socket, and it never
 * accepts a SARS username or password.
 *
 * Sources (read 9 Nov 2026):
 * - https://www.sars.gov.za/individuals/i-need-help-with-my-tax/your-tax-questions-answered/independent-software-vendors/
 * - https://www.sars.gov.za/wp-content/uploads/Docs/InterfaceSpecs/Final-v3-ISV-Systems-Interface-Terms-and-Conditions-21-June-2017.pdf
 * - https://www.sars.gov.za/businesses-and-employers/third-party-data/third-party-data-submission-at-a-glance/
 * - https://www.sars.gov.za/types-of-tax/value-added-tax/obligations-of-a-vat-vendor/
 */
export const VAT201_ISV_SUBMIT_ENABLED = false;

export type Vat201IsvRequirement = {
  step: string;
  detail: string;
};

export function vat201IsvRequirements(): Vat201IsvRequirement[] {
  return [
    {
      step: 'Sign the ISV terms',
      detail:
        'Sign the SARS Independent Software Vendor Systems Interface Terms and Conditions. SARS publishes the 21 June 2017 version and can issue a later one.',
    },
    {
      step: 'Email the application',
      detail:
        'Send the signed terms to clsisvapplications@sars.gov.za and ask for the Tax Returns Submissions category, specifically VAT201.',
    },
    {
      step: 'Confirm VAT201 is in scope',
      detail:
        'The public ISV page lists income tax, PAYE, transfer duty and tax directives. It does not name VAT201. Ask SARS in writing to include VAT201 before any interface is built.',
    },
    {
      step: 'Pass acceptance testing',
      detail:
        'Authorisation is at SARS’s discretion. The interface specification is provided after SARS accepts the application. There is no public VAT201 schema to code against.',
    },
    {
      step: 'Receive a product access key',
      detail:
        'SARS issues a key for the product. Do not give SupplierAdvisor® a SARS username or password.',
    },
    {
      step: 'Activate the ISV on eFiling',
      detail:
        'Big Five Foods activates SupplierAdvisor® on its own eFiling profile and provides the login key SARS issues at activation. The person who submits must already have eFiling rights. A tax practitioner can submit only where they are mandated.',
    },
    {
      step: 'Pay on eFiling or at the bank',
      detail:
        'The ISV channel submits the return. Accredited products still leave the VAT payment on eFiling. SupplierAdvisor® records that payment and posts the settlement journal locally.',
    },
  ];
}

export type Vat201IsvResult = {
  ok: false;
  enabled: false;
  calledSars: false;
  reason: string;
  requirements: Vat201IsvRequirement[];
};

/** Never calls SARS. The flag is off, and a future true flag still has no client. */
export function vat201IsvSubmit(): Vat201IsvResult {
  return {
    ok: false,
    enabled: VAT201_ISV_SUBMIT_ENABLED,
    calledSars: false,
    reason: VAT201_ISV_SUBMIT_ENABLED
      ? 'The ISV flag is on, but SupplierAdvisor® has no accredited client and will not call SARS.'
      : 'Programmatic submission is off. SARS has no public VAT201 API. The ISV channel needs accreditation SupplierAdvisor® does not have.',
    requirements: vat201IsvRequirements(),
  };
}
