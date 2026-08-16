/**
 * Shared IFRS / SA GAAP disclaimer for management accounts and AFS.
 * Client-safe (no server imports).
 */

export const GAAP_DISCLAIMER_TITLE = 'IFRS / SA GAAP basis';

/** One-line / banner text for screens and PDF footers. */
export const GAAP_DISCLAIMER_SHORT =
  'Prepared on the accrual basis from the double-entry general ledger, in accordance with the presentation principles of IFRS (International Financial Reporting Standards), which is SA GAAP for IFRS reporters. Compiled and unaudited — not an audit, review, or assurance opinion.';

/** Slightly longer form for AFS covers and Note 1. */
export const GAAP_DISCLAIMER_LONG =
  'These reports are compiled from the company double-entry general ledger on the accrual basis of accounting. Recognition, classification, and statement presentation follow IFRS (International Financial Reporting Standards) — SA GAAP for companies that apply IFRS. Invoice issue recognises revenue or expense and VAT; cash applied settles receivables or payables; posted journals are reversed rather than deleted; the balance sheet is presented as at period end. Estimates that require management judgement (expected credit losses, impairment tests, leases, and deferred tax) are not computed automatically and must be posted as journals if they apply. These statements are unaudited and do not constitute an audit, independent review, or other assurance engagement.';

export const GAAP_DISCLAIMER_PDF_FOOTER =
  'IFRS / SA GAAP: accrual double-entry ledger; presentation principles of IFRS (SA GAAP for IFRS reporters). Compiled from posted journals. Unaudited — not an audit or assurance opinion.';
