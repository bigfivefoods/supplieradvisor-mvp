/**
 * AFS note and policy copy that must match what the ledger actually does.
 * Brief 7 — honesty pack. No new engines here.
 */

export const AFS_NOT_CONSOLIDATED =
  'These statements are those of the reporting entity. They are not consolidated financial statements (IFRS 10). Intra-group balances and transactions are not eliminated. A holding-tree view, where used, is an aggregation without consolidation adjustments.';

export const AFS_NOTE2_REVENUE =
  'Revenue is recognised when an invoice is issued (accrual), not when cash is received. Bank receipts matched to invoices settle receivables and do not create a second sale. Cash received before any invoice is issued is a contract liability in 2140 Customer deposits until that invoice is issued. A single performance obligation is assumed per sales invoice; multi-element contracts, variable consideration, and principal-versus-agent assessments are not modelled.';

export const AFS_NOTE3_COGS =
  'Inventories are measured at cost (IAS 2, simplified). Cost of sales is recognised when a sales invoice line has quantity and a known unit cost from the product catalogue or stock movements (Dr 5100 · Cr 1140). Lines with no product, a zero cost, or a service/membership invoice do not post COGS — selling price is never used as cost. NRV write-downs and standard costing are not automated.';

export const AFS_NOTE6_RECEIVABLES =
  'Trade and other receivables comprise control account 1130, named customer leaves (1181+), and member/patient leaves (1180-*). The face of the statement of financial position shows one current line. Expected credit losses are measured on Finance → ECL using management aging rates and posted to 1135 / 6820. 1135 is a current contra and is presented net against this note. Amounts with a due date more than 12 months after the reporting date are presented as non-current; if due_date is missing they remain current.';

export const AFS_NOTE8_PAYABLES =
  'Trade and other payables comprise control account 2110, the 2180 suppliers & contractors header, unique 2180-* leaves, and any legacy 2181+ named AP accounts. The face of the statement of financial position shows one current line. 2140 Customer deposits is an IFRS 15 contract liability (current), listed next to trade payables — it is not mixed into AP leaves. Amounts with a due date more than 12 months after the reporting date are presented as non-current; if due_date is missing they remain current.';

export const AFS_POLICY_IFRS15 =
  'A single performance obligation is assumed per sales invoice. Cash received before issue is credited to 2140 Customer deposits (contract liability) and recognised as revenue when the invoice is issued. Multi-element contracts, variable consideration, and principal-versus-agent assessments are not modelled automatically.';

export const AFS_POLICY_IAS2 =
  'Inventories are carried at cost on 1140. When a sales invoice is issued for goods with a known stock unit cost, that cost is recognised in 5100 and inventory is relieved. If unit cost is unknown or zero, COGS is not posted. NRV, the retail method, and a standard-costing engine are not modelled.';

export const AFS_POLICY_IFRS9 =
  'Trade receivables and payables are recognised at transaction price. Expected credit losses are measured on the ECL worksheet (Finance → ECL) using management aging rates and posted to 1135 / 6820. Fair-value instruments, write-offs, and staging (SICR) are not automated.';

export const AFS_MANUAL_STANDARDS =
  'IFRS 16 leases, IAS 12 deferred tax, IAS 21 foreign-currency retranslation, IFRS 15 multi-element allocations, IFRS 9 write-off/SICR, IFRS 10 consolidation, IAS 32 offset, and IAS 37 provisions are not automated. Post journals if those standards apply.';

export const AFS_IAS10 =
  'These compiled statements do not automatically identify adjusting or non-adjusting events after the reporting date (IAS 10). Disclose such events outside this pack if material.';
