import type { GuideEdge, GuideFeature, GuideNode, ModuleGuide } from '@/lib/help/types';
import { WRITE_ACCOUNTING, viewRoleLabels } from '@/lib/help/roles';

const WHO_OPEN =
  'Owner and Finance can open Finance. On the default matrix Admin, Member, Viewer, Operations, and Sales have no accounting access, so the sidebar does not show Finance. The gate says “Your role (…) cannot access Accounting.”';

const WHO_WRITE = `${WHO_OPEN} Posting a journal, allocating a bank line, and recording a payment also need accounting write, which Owner and Finance have. Anyone else gets “${WRITE_ACCOUNTING}”.`;

const BOOKS =
  'A chart of accounts exists for this company. Seed defaults on Chart of accounts if the pickers are empty. A locked month rejects a post.';

const PERIOD_DENIED = 'Your role (…) cannot perform this action. Allowed: owner, admin, finance.';

function feat(row: GuideFeature): GuideFeature {
  return row;
}

const features: GuideFeature[] = [
  feat({
    id: 'chart',
    name: 'Chart of accounts',
    href: '/dashboard/accounting/chart-of-accounts',
    summary: 'The chart is the list of accounts every journal posts to, with period totals from posted journals.',
    who: WHO_WRITE,
    prerequisites: [
      'Open the company whose books you are keeping.',
      'Accounting settings decide where new customer and supplier accounts nest. Set that before you expect a unique AR or AP number.',
    ],
    steps: [
      'Open Chart from Finance.',
      'Set the period with the period control. Totals on this screen are posted balances for that period.',
      'Search with “Search code or name…”. Filter “All types”, and use the status filter for active or inactive accounts.',
      'Press Download .xlsx to export the period.',
      'Press Seed defaults to load the standard chart when this company has none.',
      'Press Customer & supplier accounts to create the unique AR and AP numbers for parties already on the books.',
      'Press Add account. Enter the code, the name, and the type, then save. A header account can group children. An inactive account stays on the chart and cannot be posted to.',
    ],
    behind: [
      'Balances are summed from posted journal lines for the period. Draft journals are not in the totals.',
      'Seed defaults writes the standard chart for this company. It does not copy another company’s books.',
      'Customer & supplier accounts creates control accounts such as 1180-* for customers and 2180-* for suppliers when those parties exist.',
    ],
    errors: [
      {
        message: WRITE_ACCOUNTING,
        fix: 'Ask an owner to give you the Finance role. Viewers of the page still cannot seed or add an account.',
      },
      {
        message: 'Account … is inactive',
        fix: 'Pick an active posting account, or mark the account active on the chart before you post.',
      },
      {
        message: 'Cannot post to header account …',
        fix: 'Post to a child account. Header accounts only group the chart.',
      },
    ],
    faqs: [
      {
        q: 'Why is an account missing from a journal picker?',
        a: 'The picker loads the company’s chart. An inactive account, a header, or an account past the first page of an old picker will not be offered. Search the chart, and use Add account if it was never created.',
      },
    ],
  }),
  feat({
    id: 'parties',
    name: 'Customers and suppliers on the books',
    href: '/dashboard/accounting/parties',
    summary: 'Parties shows who you sell to and who you buy from, and the AR or AP account each one uses.',
    who: WHO_OPEN,
    prerequisites: [
      'Add the person or firm on Customers or Suppliers first. This screen does not create the trading relationship.',
    ],
    steps: [
      'Open Parties from Finance. The title is Customers & suppliers.',
      'Press Customers · you sell, Suppliers · you buy, or Both books to filter the list.',
      'On a row, set Customer or supplier book to Customer · you sell, Supplier · you buy, or Both books.',
      'Use the Customers and Suppliers links on the page when you need to add someone you invoice or someone you pay.',
    ],
    behind: [
      'A firm that is both a customer and a supplier gets two accounts. SupplierAdvisor® does not net them into one balance.',
      'Customer accounts sit on the AR side (1180-* when that pattern is used). Supplier accounts sit on the AP side (2180-*).',
    ],
    errors: [
      {
        message: 'Your role (…) cannot access Accounting.',
        fix: 'Only Owner and Finance open this screen on the default matrix.',
      },
    ],
    faqs: [
      {
        q: 'Can one firm be a customer and a supplier?',
        a: 'Yes. Choose Both books. They keep two accounts, and invoices and bills stay on their own sides.',
      },
    ],
  }),
  feat({
    id: 'journals',
    name: 'Journals',
    href: '/dashboard/accounting/journal-entries',
    summary: 'A journal records a balanced debit and credit in the company ledger. Drafts can stay unbalanced until you post.',
    who: WHO_WRITE,
    prerequisites: [BOOKS, 'You need at least two lines with amounts before a post will succeed.'],
    steps: [
      'Open Journals from Finance.',
      'Filter All statuses, Posted, Draft, or Void. The scope Posted + my drafts hides other people’s drafts. Everyone’s drafts shows them.',
      'Press New journal. The form is titled New journal entry.',
      'Set Date and Memo. On each line choose Select account…, then enter Debit or Credit and an optional line Memo. Press + Add line for another line.',
      'Watch Debits, Credits, and the Balanced or Out of balance strip. A post needs the two sides within half a cent and a debit total above zero.',
      'Leave Post to the company ledger (must balance) ticked to post now, or clear it and press Save draft. The post button reads Post entry, Save & post, or Save draft depending on that tick.',
      'On a draft row, press Edit, then Post. Confirm Post this draft?',
      'On a posted row, press Reverse and confirm Reverse this posted journal? Posted journals are not deleted.',
      'Use Allocation review, then Re-run review, to see lines that may be on the wrong account. Press Keep classification or Reclassify to suggested. Per line, Keep account or Reclassify.',
      'To change a posted journal, Edit it and press Save reclassification. That writes a reversal and a new correction.',
    ],
    behind: [
      'Save draft stores status draft and does not require the journal to balance. Post stores status posted, sets posted at, and source manual.',
      'A post is refused when the period is locked. The API says “Period … is locked. Unlock the period or post as draft.” The shared poster says “Period … is locked — cannot post”.',
      'Reverse writes a new journal with source reversal that swaps debits and credits. The original stays posted and is stamped with the reversing journal. It is not voided.',
      'Reclassify writes the reversal and a source correction journal, then stamps the original as reversed.',
      'Void is only for a draft. The confirm says “Void this draft? Posted journals cannot be deleted — reverse them instead.”',
    ],
    errors: [
      {
        message: 'Journal must balance. Debits … ≠ credits …',
        fix: 'Change a line so debits equal credits, or save a draft instead of posting.',
      },
      {
        message: 'At least two journal lines required',
        fix: 'Add a second line. A single-sided entry cannot post.',
      },
      {
        message: 'A journal line cannot carry both a debit and a credit',
        fix: 'Put the debit on one line and the credit on another.',
      },
      {
        message: 'Only drafts can be posted',
        fix: 'The row is already posted. Reverse it, or reclassify it, instead of pressing Post again.',
      },
      {
        message: 'Only posted journals can be reversed',
        fix: 'A draft is voided, not reversed.',
      },
      {
        message: 'Already reversed by journal …',
        fix: 'This journal already has a reversal. Do not reverse it again.',
      },
      {
        message: 'Unbalanced journal (Dr … vs Cr …)',
        fix: 'The poster refused the lines. Equalise the amounts and post again.',
      },
    ],
    faqs: [
      {
        q: 'Does a draft hit the profit and loss?',
        a: 'No. Management accounts, the ledger, and the statements read posted journals. A draft stays out until you post it.',
      },
      {
        q: 'Can I delete a posted journal?',
        a: 'No. Void is for drafts. Reverse writes an opposite journal. Reclassify writes that reversal plus a corrected journal.',
      },
    ],
  }),
  feat({
    id: 'ledger',
    name: 'General ledger',
    href: '/dashboard/accounting/general-ledger',
    summary: 'The general ledger lists every posted debit and credit in the period, with a running balance per account.',
    who: WHO_OPEN,
    prerequisites: ['Journals for the period must be posted. Drafts do not appear.'],
    steps: [
      'Open Ledger from Finance. The title is General ledger.',
      'Set the period. The description says accrual basis under IAS 1, and that the statement is unaudited.',
      'Read Period debits, Period credits, Journals, and In balance or Out by ….',
      'Press Refresh to reload. Press Print / PDF to print the page.',
    ],
    behind: [
      'Lines come from posted journal lines in the period, with the opening balance carried in and a closing balance carried out.',
      'An empty period shows “No ledger for this period.” Nothing is filled in to make the page look busy.',
    ],
    errors: [
      {
        message: 'No ledger for this period.',
        fix: 'Widen the period, or post a journal dated inside it.',
      },
    ],
    faqs: [
      {
        q: 'The ledger is out of balance. What does that mean?',
        a: 'The stat reads Out by the difference between period debits and credits. A posted journal that does not balance should have been refused, so check for a period that starts mid-way through an entry or a report that did not finish loading. Press Refresh.',
      },
    ],
  }),
  feat({
    id: 'ar',
    name: 'Customer invoices',
    href: '/dashboard/accounting/accounts-receivable',
    summary: 'Accounts receivable records what customers owe, recognises revenue and output VAT when the invoice is issued, and records receipts in the books.',
    who: `${WHO_OPEN} Creating and editing an invoice on the invoice API checks company membership. Recording a payment from this screen needs accounting write (Owner or Finance).`,
    prerequisites: [
      'The customer name is required.',
      'The chart needs AR 1130 (or the party control account), sales revenue 4100, and VAT output 2120 when the invoice has tax.',
      'A receipt does not send money. It only updates the books.',
    ],
    steps: [
      'Open AR from Finance. The title is Accounts receivable.',
      'Read Total, Open, Overdue, and Collected / paid. Charts are Aging and By status.',
      'Search with “Search invoices…”. Filter status: draft, sent, partial, paid, overdue, or void.',
      'Press New invoice. The fields are Customer, Issue date, Due date, Currency, Line description, Qty, Unit price, Tax %, and Notes. Press Create. The new invoice is a draft.',
      'On the row, Mark sent. That issues the invoice and posts the recognition journal.',
      'Press Record payment. Enter Amount, Method (EFT, Cash, Card, YOCO, Stripe, Crypto, or Other), and Reference, then press Record payment.',
      'Mark paid in full sets the status when you are recording that the balance is cleared.',
      'Void reverses the books for that invoice.',
    ],
    behind: [
      'A draft does not post. Statuses that count as issued are sent, partial, paid, overdue, issued, viewed, and unpaid.',
      'Issue posts source invoice_recognition: debit AR 1130 (or the party account), credit revenue 4100 (or 4400 for a membership account), and credit VAT output 2120 when tax is above zero.',
      'A receipt posts source invoice_settlement: debit bank 1110, credit AR. The invoice becomes partial or paid from the amount paid.',
      'A receipt against a draft, before issue, posts a customer deposit: debit bank, credit 2140.',
      'Void runs the reversal of the recognition, settlement, and deposit journals.',
      'Recording the receipt does not transfer money at a bank.',
    ],
    errors: [
      {
        message: 'Customer name required',
        fix: 'Enter the customer on New invoice before Create.',
      },
      {
        message: 'COA missing AR (1130) or sales revenue (4100) — seed Chart of Accounts',
        fix: 'Open Chart and press Seed defaults, then Mark sent again.',
      },
      {
        message: 'COA missing VAT output (2120)',
        fix: 'Add 2120, or seed the chart, before you issue an invoice that has tax.',
      },
      {
        message: 'SupplierAdvisor® cannot settle …',
        fix: 'The receipt is larger than the open balance. Enter an amount up to the balance.',
      },
    ],
    faqs: [
      {
        q: 'I pressed Mark paid in full and the bank did not move. Why?',
        a: 'Mark paid in full changes the invoice status. The settlement journal is posted when you Record payment. Neither action sends money from a bank.',
      },
    ],
  }),
  feat({
    id: 'ecl',
    name: 'Expected credit losses',
    href: '/dashboard/accounting/ecl',
    summary: 'The ECL worksheet estimates the IFRS 9 allowance on trade receivables and can post it to the ledger.',
    who: WHO_WRITE,
    prerequisites: ['Issued customer invoices exist so the aging has balances to rate.'],
    steps: [
      'Open ECL from Finance. The title is Expected credit losses.',
      'Set the aging rates (%) for each bucket.',
      'Press Recalculate to rebuild the worksheet.',
      'Press Post allowance to GL when the worksheet is the allowance you want in the books.',
    ],
    behind: [
      'The post debits credit-loss expense 6820 and credits the allowance 1135.',
      'The screen carries the same unaudited IFRS note as the other statements. It does not replace a credit decision.',
    ],
    errors: [
      {
        message: WRITE_ACCOUNTING,
        fix: 'Owner or Finance must post the allowance. Recalculate is still a write to the worksheet.',
      },
    ],
    faqs: [
      {
        q: 'Does this email the customer?',
        a: 'No. It only measures the allowance and, when you post, writes the journal. Collections stay on Customers → Money.',
      },
    ],
  }),
  feat({
    id: 'ap',
    name: 'Supplier bills',
    href: '/dashboard/accounting/accounts-payable',
    summary: 'Accounts payable records supplier bills, recognises the cost and input VAT when the bill is issued, and records payments in the books.',
    who: `${WHO_OPEN} The invoice API checks company membership for the bill itself. Recording a payment needs accounting write.`,
    prerequisites: [
      'The supplier name is required.',
      'The chart needs AP 2110 (or the party control), an expense or inventory account, and VAT input 1150 when the bill has tax.',
      'A payment does not send money.',
    ],
    steps: [
      'Open AP from Finance. The title is Accounts payable.',
      'Press New bill. Fields match the invoice form with Supplier instead of Customer. Press Create. The bill starts as a draft.',
      'If you arrived from a purchase order, the banner says “Prefilling a supplier bill from {number}. This is buyer AP, not a customer invoice.” Check the lines, then Create.',
      'Mark sent to issue the bill and post the recognition journal.',
      'Press Record payment, enter Amount, Method, and Reference, then Record payment.',
      'Mark paid in full or Void from the row actions, the same set as customer invoices.',
    ],
    behind: [
      'Issue posts debit inventory or expense, debit VAT input 1150, credit AP 2110. Materials map to 1140, cost of sales to 5100, a fixed asset line to 1210, and anything else falls back to 6990.',
      'A bill for a purchase order that already posted 1140 on accept is skipped, reason po_already_allocated, so the cost is not recognised twice.',
      'A payment posts source invoice_settlement: debit AP, credit bank.',
      'Void reverses those journals. The payment still does not leave the bank by itself.',
    ],
    errors: [
      {
        message: 'COA missing AP (2110) or an inventory/expense account — seed Chart of Accounts',
        fix: 'Seed the chart, then Mark sent again.',
      },
      {
        message: 'COA missing VAT input (1150)',
        fix: 'Add 1150 before you issue a bill that has tax.',
      },
      {
        message: 'SupplierAdvisor® cannot settle …',
        fix: 'Lower the payment to the open balance on the bill.',
      },
    ],
    faqs: [
      {
        q: 'I accepted a purchase order and the bill did not post 1140 again. Is that wrong?',
        a: 'No. Accept already debited inventory 1140 and credited AP. The bill is skipped so the same goods are not capitalised twice. Receive on the purchase order only adds warehouse quantity.',
      },
    ],
  }),
  feat({
    id: 'payments',
    name: 'Payments',
    href: '/dashboard/accounting/payments',
    summary: 'Payments is the log of receipts and supplier payments recorded in the books.',
    who: WHO_WRITE,
    prerequisites: ['A positive amount is required. Linking an invoice is optional. Nothing on this screen sends money.'],
    steps: [
      'Open Payments from Finance. The title is Payments & treasury.',
      'Read Inflow, Outflow, and Net. Filter All directions, Inbound, or Outbound.',
      'Press Record payment.',
      'Enter Amount, Direction (Inbound (receipt) or Outbound (payment)), Counterparty, Method, and Reference. Press Save.',
      'The table columns are Date, Direction, Counterparty, Method, Reference, Invoice, Amount, and Status. A saved row shows completed.',
    ],
    behind: [
      'If you pass an invoice, the direction is taken from the invoice: a bill becomes outbound, a customer invoice becomes inbound. The form direction is not used in that case.',
      'Settlement journals match the invoice: debit bank and credit AR, or debit AP and credit bank.',
      'An inbound amount with no invoice posts a customer deposit to 2140.',
      'When a bank account is sent with the payment, that account’s current balance is adjusted in the books. The bank itself is not instructed.',
    ],
    errors: [
      {
        message: 'companyId and positive amount required',
        fix: 'Enter an amount greater than zero and make sure a company is selected.',
      },
      {
        message: WRITE_ACCOUNTING,
        fix: 'Owner or Finance must record the payment.',
      },
    ],
    faqs: [
      {
        q: 'Which methods can I store?',
        a: 'EFT, cash, card, YOCO, Stripe, crypto, and other. Storing the method does not call that provider.',
      },
    ],
  }),
  feat({
    id: 'debit-orders',
    name: 'Debit-order file',
    href: '/dashboard/accounting/debit-orders',
    summary: 'The debit-order file lists member amounts that are VAT-inclusive so you can export them and match the same reference on the bank.',
    who: WHO_OPEN,
    prerequisites: [
      'Member debit details live on the gym or membership book. This screen reads the batch. It does not create the mandate.',
    ],
    steps: [
      'Open Debit orders from Finance.',
      'Read Members, Batch total, VAT (sample), and Missing bank.',
      'VAT (sample) is the VAT split of the first line in the file, not the VAT on every member.',
      'Press Export CSV. The file downloads from the debit batch for this company.',
      'On Bank, match the bank line that carries the same reference.',
    ],
    behind: [
      'Amounts are treated as VAT-inclusive. Export does not submit a debit order to a bank.',
      'Missing bank counts lines that have no bank details. Fix those on the member mandate before you expect a collection.',
    ],
    errors: [
      {
        message: 'Your role (…) cannot access Accounting.',
        fix: 'Open this screen as Owner or Finance.',
      },
    ],
    faqs: [
      {
        q: 'Is this the GymAdvisor® Netcash run?',
        a: 'No. GymAdvisor® billing runs and Netcash settings are on GymAdvisor®. This Finance screen is the VAT-inclusive file you export and then match on Bank.',
      },
    ],
  }),
  feat({
    id: 'bank',
    name: 'Bank import and matching',
    href: '/dashboard/accounting/bank-reconciliation',
    summary: 'Bank stores accounts and statement lines, then posts a journal when you allocate a line or match it to an invoice or a bill.',
    who: `${WHO_OPEN} Importing a statement checks company membership. Allocate, match, and unallocate need accounting write (Owner or Finance).`,
    prerequisites: [
      'Press Account and save a bank account before you import. The import button refuses to open with “Add a bank account first, then import your statement PDF”.',
      'Allocation needs a bank general-ledger account: the account linked on the bank account, otherwise 1110, otherwise an asset marked bank or cash.',
    ],
    steps: [
      'Open Bank from Finance. The title is Bank & allocation.',
      'Press Account to add a bank account. Press Connect bank to start a feed, then Sync feed when a connection is listed.',
      'Press Import PDF/CSV. Choose the account and the file. Formats detected are auto, FNB, RMB, ABSA, Standard Bank, Nedbank, Capitec, a universal CSV, PDF, and OFX.',
      'Read Bank balance, Unallocated, Allocated, and Accounts. Filter lines with Unallocated, Allocated, Matched invoice, Excluded, or All.',
      'On an unallocated line, press Post when a proposal is shown, or open Change account / VAT.',
      'In Allocate, set GL account, Memo, and VAT code (None, VAT15 · standard, VAT0 · zero-rated, Exempt, or Out of scope). VAT amount is optional. Press Post allocation.',
      'Press Match invoice, pick the invoice or bill, and press Match & pay.',
      'Use Auto-match to score unallocated lines, Match rules for saved rules, and Mass allocate or Allocate selected for a batch. Select unallocated ticks the open lines.',
      'Exclude drops a line out of allocation. Unallocate (reverse journal — fix wrong GL/VAT) reverses the journal. Unreconcile clears the reconciled flag.',
      'Mark reconciled sets the line reconciled without changing the allocation you already posted.',
    ],
    behind: [
      'After import, auto-match runs at a minimum confidence of 90.',
      'A line’s allocation status is unallocated, allocated, matched invoice, or excluded. Its reconcile status is unreconciled, reconciled, or excluded.',
      'An inflow allocation posts source bank_allocation: debit the bank GL, credit the account you picked, and credit the tax account when VAT is set. An outflow debits the expense and credits the bank.',
      'Money in that is coded to income may be matched to a customer invoice instead. A supplier payment may be matched to a bill.',
      'An uninvoiced inflow that is a deposit is credited to 2140.',
      'Match & pay writes a payment, moves the invoice to partial or paid, and posts source invoice_settlement: debit bank and credit AR, or debit AP and credit bank. The line becomes matched invoice and reconciled.',
      'Unallocate reverses the posted journal and sets the line back to unallocated and unreconciled.',
      'Exclude does not post a journal. A balance adjustment is stored with reference BALANCE_ADJ and left excluded.',
      'Allocate does not pay the supplier or collect from the customer at the bank. It only posts the books.',
    ],
    errors: [
      {
        message: 'Add a bank account first, then import your statement PDF',
        fix: 'Press Account, save the account, then press Import PDF/CSV.',
      },
      {
        message: 'No transactions parsed from the statement…',
        fix: 'Check the file is a PDF, OFX, or a CSV the detector knows. Try the matching bank format if auto-detect parsed nothing.',
      },
      {
        message: 'PDF too large (max 12MB)',
        fix: 'Split the statement and import each part.',
      },
      {
        message: 'File does not look like a PDF or OFX…',
        fix: 'Upload the original statement, not a renamed spreadsheet.',
      },
      {
        message: 'Transaction already allocated',
        fix: 'Unallocate first if the account or the VAT code is wrong, then allocate again.',
      },
      {
        message: 'No bank GL account found…',
        fix: 'Link a GL account on the bank account, or add 1110 on the chart.',
      },
      {
        message: 'Choose an income/expense account, not the bank account itself',
        fix: 'Pick the income or expense account. The bank side is posted automatically.',
      },
      {
        message: 'Period … is locked — cannot allocate',
        fix: 'Unlock the month on Settings, or date the work in an open month.',
      },
      {
        message: 'Transaction is excluded — use Unexclude first',
        fix: 'Unexclude the line, then allocate or match it.',
      },
      {
        message: 'Invoice direction is …; bank amount is …',
        fix: 'Match money in to a customer invoice and money out to a supplier bill.',
      },
    ],
    faqs: [
      {
        q: 'Does Connect bank or Sync feed move money?',
        a: 'No. A feed pulls statement lines into this screen. Post allocation and Match & pay update the ledger only.',
      },
      {
        q: 'I allocated to the wrong account. How do I undo it?',
        a: 'Press Unallocate. That reverses the journal. Then allocate again, or use Re-allocate to different GL.',
      },
    ],
  }),
  feat({
    id: 'assets',
    name: 'Fixed assets',
    href: '/dashboard/accounting/fixed-assets',
    summary: 'The asset register capitalises property, plant and equipment, posts depreciation, and records an IAS 16 disposal.',
    who: WHO_WRITE,
    prerequisites: ['The chart needs the PPE and accumulated-depreciation accounts the register posts to, and AP when you capitalise against a creditor.'],
    steps: [
      'Open Assets from Finance. The title is Fixed assets.',
      'Press Register asset and save the asset.',
      'Press Post all to BS to capitalise every asset that is not on the balance sheet yet.',
      'Post depreciation from the asset when you are running the period charge.',
      'Dispose an asset when it leaves the register. The disposal posts the IAS 16 gain or loss.',
    ],
    behind: [
      'Capitalise posts debit PPE and credit AP, as the screen describes.',
      'A disposed asset drops out of the book-value total.',
    ],
    errors: [
      {
        message: WRITE_ACCOUNTING,
        fix: 'Owner or Finance must register, capitalise, depreciate, or dispose.',
      },
    ],
    faqs: [
      {
        q: 'Does the register calculate impairment or leases?',
        a: 'No. Impairment, leases, and deferred tax are not computed automatically. Post a journal if they apply. The annual statements say the same.',
      },
    ],
  }),
  feat({
    id: 'vat',
    name: 'VAT worksheet',
    href: '/dashboard/accounting/tax',
    summary: 'The VAT worksheet adds up input and output VAT for the period from invoices and from bank lines you have classified. It does not file a return.',
    who: `${WHO_OPEN} Classify and seed on this screen check company membership. Filing the return is on VAT201, and that filing action needs accounting write.`,
    prerequisites: [
      'Seed the VAT codes before you classify bank lines.',
      'Customer invoices and supplier bills should already be issued if you expect them in the worksheet.',
    ],
    steps: [
      'Open VAT from Finance. The title is Tax & VAT.',
      'Set the period. The default is this quarter. Read the IFRS / SA GAAP basis note. It says the pack is compiled and unaudited.',
      'Press Seed ZA VAT if you have no codes. That loads standard, zero, exempt, and out of scope.',
      'Read the VAT return box: Output VAT (sales), Input VAT (purchases), and Net VAT. The badge says Payable to SARS or Refund due.',
      'Invoices are treated as tax-exclusive. Bank lines default to VAT-inclusive. The setup note on the page says bank VAT uses 15/115.',
      'Under Classify bank transactions, tick lines and set a code, or press Auto-suggest all. Quick codes are VAT15, VAT0, EXEMPT, and OUT.',
      'Filter VAT transactions with All types, Standard-rated, Zero-rated, Exempt, Out of scope, or Unclassified. Side filters are Input & output, Output (sales), and Input (purchases). Source filters are Invoices & bank, Invoices only, and Bank only.',
      'Select rows and press Reallocate selected when a code is wrong. A bank line that was already posted is corrected by unallocate on Bank, which this screen links.',
      'Press Add rate for a code of your own. The form is New tax rate: Code, Name, Rate %, and a category such as Standard-rated (e.g. 15%). Tick Default rate if it should be the default. Press Create.',
      'Open VAT201 from the header when you are ready to build the SARS return. This worksheet has no submit button.',
    ],
    behind: [
      'Output VAT is sales on customer invoices plus bank inflows you marked standard-rated. Input VAT is purchases on supplier bills plus bank outflows marked standard-rated and recoverable.',
      'Net VAT is output minus input. The worksheet reads invoice issue dates and bank transaction dates. It is not the locked VAT201.',
      'Seed writes VAT15, VAT0, EXEMPT, and OUT when they are missing.',
      'The screen does not log in to SARS and does not submit a return.',
    ],
    errors: [
      {
        message: 'Select bank lines first',
        fix: 'Tick at least one bank line before you classify.',
      },
      {
        message: 'No unclassified lines found',
        fix: 'Every line in the period already has a code. Change the period or reallocate a code that is wrong.',
      },
      {
        message: 'code, name, and rate required (or pass seed/classify action)',
        fix: 'Fill Code, Name, and Rate % on New tax rate, or use Seed ZA VAT.',
      },
    ],
    faqs: [
      {
        q: 'The worksheet does not match account 1150 or 2120. What now?',
        a: 'Those accounts follow the invoice and bill journals. The worksheet follows classified invoices and bank lines for the period you picked. Use the VAT201 reconciliation when you need the return compared with the ledger.',
      },
    ],
  }),
  feat({
    id: 'vat201',
    name: 'Build and file the VAT201',
    href: '/dashboard/accounting/vat201',
    summary:
      'SupplierAdvisor® builds the SARS VAT201 from the posted ledger. It does not submit the return to SARS.',
    who: 'Owner and Finance can open the screen. Owner, Admin, and Finance may edit VAT settings, but Admin has no accounting access on the default matrix so the screen does not open for Admin. The screen says “Company admins, owners, and finance can edit these settings.” Filing and the settlement journal need accounting write. The screen says “Only an owner or finance user can file or post the settlement.”',
    prerequisites: [
      'Save a VAT number, a basis, a period category, an effective date, and a first period end. If those dates are blank, the return cannot be built. SupplierAdvisor® does not invent a VAT number.',
      'Posted journals, issued invoices, and payments for the period are what the return reads.',
    ],
    steps: [
      'Open VAT201 from Finance.',
      'Under VAT registration set VAT number, Basis (Payment, Invoice, or Hybrid), Period category (A · monthly through E · annual), Filing channel (eFiling · last business day, or Manual · the 25th), Effective date, and First period end. Press Save VAT settings.',
      'Choose the tax period. The label shows the period and due date, and a status of draft, reviewed, submitted, or paid.',
      'On the payment basis, VAT is due or claimable when cash is received or paid. The ledger still posts output VAT on the invoice date and input VAT on the bill date, so the return will not match accounts 1150 and 2120 until those invoices are paid.',
      'On the invoice basis, output VAT follows the invoice date and input VAT follows the bill date, including amounts that are still unpaid.',
      'On the hybrid basis, output VAT follows the invoice date and input VAT follows the cash date. Unpaid supplier bills stay out of input tax. Hybrid is not a third SARS category.',
      'Read Output tax, Input tax, Refundable or Payable, and Due. In eFiling fields, use the copy control on a field. The clipboard value has no currency symbol.',
      'Open Supporting pack and switch Output VAT, Input VAT, Missing tax invoices, and Reconciliation. A flagged row is marked Difference.',
      'Press Submit to SARS. One push marks the return Reviewed, locks the months in the period, and opens SARS eFiling in a new tab. Copy each field into eFiling in order. You can also press Open SARS eFiling.',
      'SupplierAdvisor® does not submit the return. There is no public VAT201 API, and the ISV steps on the page include signing the SARS Independent Software Vendor terms. The programmatic submit action stays off.',
      'After you have submitted on eFiling, enter Submission reference and Submission date, then press Record submission.',
      'When the payment has been made to SARS, enter Payment date and Payment reference, tick “I confirm this payment was made to SARS. SupplierAdvisor® may post the settlement journal, clearing 1150 and 2120 through 2125 and the bank.” and press Record payment.',
      'Open Diesel refund fields 21–37 and leave them blank on eFiling unless a diesel refund is registered. Field 38 equals field 20.',
      'Use CSV or PDF in the header to download the return you are looking at.',
    ],
    behind: [
      'Submit to SARS calls review. Status moves from draft to reviewed. Each month in the period is locked with the note “Locked by VAT201 review”.',
      'Record submission moves the return to submitted. Record payment moves it to paid and posts the settlement journal.',
      'The settlement debits 2120 and credits 2125 for output, debits 2125 and credits 1150 for input, and clears the net through 2125 and bank 1110. It does not send the money.',
      'The books must contain 1150, 2120, and the bank account. 2125 is created as VAT payable / receivable (SARS) if it is missing.',
      'SupplierAdvisor® never asks for a SARS username or password. A body that contains one is refused.',
      'If the ledger moves after the lock, the screen says “The ledger moved after this return was locked. The figures below are the locked VAT201.”',
    ],
    errors: [
      {
        message: 'Enter the VAT number.',
        fix: 'Fill VAT number and press Save VAT settings.',
      },
      {
        message: 'A SARS VAT number is 10 digits and starts with 4.',
        fix: 'Enter the 10-digit number from the registration. Do not add spaces or a name.',
      },
      {
        message: 'Set the VAT period before filing.',
        fix: 'Save the effective date and the first period end, then pick a tax period.',
      },
      {
        message: 'Set the VAT period to build this return.',
        fix: 'The dates or the category are still blank. Save VAT settings first. The return is not filled with example rows.',
      },
      {
        message: 'This return is already submitted.',
        fix: 'Submit to SARS is disabled once the status is submitted or paid. Do not review it again.',
      },
      {
        message: 'Review the return before recording the SARS reference.',
        fix: 'Press Submit to SARS so the status is Reviewed, then Record submission.',
      },
      {
        message: 'Enter the eFiling reference and the submission date.',
        fix: 'Fill Submission reference and Submission date.',
      },
      {
        message: 'Record the SARS submission before the payment.',
        fix: 'Record submission first. Record payment stays for after that.',
      },
      {
        message: 'Confirm the payment before SupplierAdvisor® posts the journal.',
        fix: 'Tick the confirmation that the payment was made to SARS.',
      },
      {
        message: 'Enter the payment date.',
        fix: 'Set Payment date before Record payment.',
      },
      {
        message: 'This return already has a settlement journal.',
        fix: 'The clearing journal is already posted. Do not record the payment again.',
      },
      {
        message: 'This return has no VAT to settle.',
        fix: 'There is no net VAT to clear. Record the submission if you filed a nil return, and do not expect a settlement journal.',
      },
      {
        message: 'SupplierAdvisor® does not accept a SARS username or password.',
        fix: 'Sign in on eFiling yourself. Do not paste SARS credentials into SupplierAdvisor®.',
      },
      {
        message: 'Chart of accounts is missing 1150.',
        fix: 'Seed the chart so 1150, 2120, and the bank account exist, then record the payment again. The same message is used for 2120 and the bank code.',
      },
    ],
    faqs: [
      {
        q: 'Does SupplierAdvisor® send the VAT201 to SARS?',
        a: 'No. Submit to SARS marks the return Reviewed and opens eFiling. You copy the fields. Programmatic submission is off because SARS has no public VAT201 API and SupplierAdvisor® is not accredited as an Independent Software Vendor.',
      },
      {
        q: 'What happens when I press Submit to SARS?',
        a: 'The return is locked, the months in the period are locked, and eFiling opens so you can copy the fields. The button is disabled after the return is submitted or paid. The screen does not show a separate Reopen button.',
      },
      {
        q: 'The VAT201 does not match account 1150 or 2120. What now?',
        a: 'On the payment basis the return follows cash, while those accounts follow the invoice or bill date. Open Reconciliation. A real difference is badged Difference. It is not an example figure.',
      },
    ],
  }),
  feat({
    id: 'budget',
    name: 'Annual budget',
    href: '/dashboard/accounting/budget',
    summary: 'The annual budget is a 12-month plan by account. Management accounts and reports compare it with posted actuals after you publish it.',
    who: WHO_WRITE,
    prerequisites: [
      'The financial year-end is set under Company → Settings. This screen does not change the year-end.',
    ],
    steps: [
      'Open Budget from Finance. The title is Annual budget.',
      'Filter All P&L, Revenue, COGS, or Expenses and enter the months.',
      'Press Copy prior FY to start from last year’s plan.',
      'Press Discard my draft to drop the unpublished copy on your login.',
      'Press Publish to company. Confirm “Publish this plan to the company books? Everyone with finance access will see it on management accounts, cash flow, and reports.”',
      'Press Plan vs actual to jump to the comparison.',
    ],
    behind: [
      'Until you publish, the plan is your working copy. A colleague’s draft does not overwrite it.',
      'Published figures are what management accounts, cash flow, and reports read as the budget.',
    ],
    errors: [
      {
        message: 'No budget for this period yet',
        fix: 'That message is on management accounts and reports until a plan is published for the period.',
      },
      {
        message: WRITE_ACCOUNTING,
        fix: 'Owner or Finance must publish. A view-only role cannot publish.',
      },
    ],
    faqs: [
      {
        q: 'Will publishing change the profit and loss?',
        a: 'No. The profit and loss stays on posted journals. The budget is only the comparison column.',
      },
    ],
  }),
  feat({
    id: 'management',
    name: 'Management accounts',
    href: '/dashboard/accounting/management',
    summary: 'Management accounts is the profit and loss for the period, from posted journals, with budget against actual when a plan is published.',
    who: WHO_OPEN,
    prerequisites: ['Post the journals, invoices, and bills for the period first. The default period is year to date.'],
    steps: [
      'Open Management from Finance. The title is Management accounts.',
      'Set the period. Read the IFRS / SA GAAP basis note. It says compiled and unaudited.',
      'Read the income, cost of sales, and expense sections, and the sales-origin list.',
      'If a bank line is still unallocated, follow the banner to Bank.',
      'Press One-pager PDF to download the pack. Press Open AFS for the annual statements. Press Refresh to reload.',
      'The charts are Period P&L bridge, Expense mix, 12-month P&L trend, and 12-month cash trend.',
    ],
    behind: [
      'Figures come from the same posted ledger as the balance sheet, the cash flow, and the annual statements.',
      'Sales origin splits exclusive value from issued invoices, bank lines coded to income, and journals.',
      '“No posted journals in {period}” means that period has nothing posted. The page does not substitute example rows.',
      '“No budget for this period yet” means no published plan covers the period.',
    ],
    errors: [
      {
        message: 'Could not build PDF',
        fix: 'Press Refresh and try One-pager PDF again. If the period has no posted journals, the PDF has nothing to compile.',
      },
      {
        message: 'No income posted in this period',
        fix: 'Issue a customer invoice with Mark sent, allocate a bank inflow to income, or post a revenue journal.',
      },
    ],
    faqs: [
      {
        q: 'Are management accounts a filing?',
        a: 'No. The note says compiled and unaudited, and that they are not an audit, review, or assurance opinion.',
      },
    ],
  }),
  feat({
    id: 'balance-sheet',
    name: 'Balance sheet',
    href: '/dashboard/accounting/balance-sheet',
    summary: 'The balance sheet is the statement of financial position at the period end, from every posted journal up to that date.',
    who: WHO_OPEN,
    prerequisites: ['Choose the date you want the position “as at”. Draft journals are excluded.'],
    steps: [
      'Open Balance sheet from Finance. The title is Statement of financial position.',
      'The description says it is an IAS 1 balance sheet as at the period end, and that it is unaudited.',
      'Set the period end, then read assets, liabilities, and equity.',
      'Press Refresh or Print / PDF.',
    ],
    behind: [
      'The statement uses posted journals through the date you picked, not only journals inside the month.',
      'An empty date shows “No statement of financial position for this date”.',
    ],
    errors: [
      {
        message: 'No statement of financial position for this date',
        fix: 'Post journals on or before that date, or pick a later date.',
      },
    ],
    faqs: [
      {
        q: 'Why does equity not equal assets minus liabilities?',
        a: 'The statement is built from posted lines. If a journal was refused as unbalanced it is not in the books. Refresh after the last post. The general ledger stat In balance is the same check for the period.',
      },
    ],
  }),
  feat({
    id: 'cash-flow',
    name: 'Cash flow',
    href: '/dashboard/accounting/cash-flow',
    summary: 'The cash-flow statement classifies cash under IAS 7 from the cash and bank ledger, and reconciles profit to operating cash.',
    who: WHO_OPEN,
    prerequisites: ['Bank and cash accounts must be posted for the period. A published budget can overlay the operating plan.'],
    steps: [
      'Open Cash flow from Finance. The title is Statement of cash flows.',
      'Set the period. The description says direct method from the cash and bank general ledger, and that it is unaudited.',
      'Read operating, investing, and financing sections, and the profit reconciliation.',
      'Open Bank vs budget for the management cash comparison. That link goes to Cash vs budget.',
    ],
    behind: [
      'Lines are classified from the bank and cash general ledger, not from a separate cashbook you type in.',
      'An empty period shows “No cash-flow statement for this period.”',
    ],
    errors: [
      {
        message: 'No cash-flow statement for this period.',
        fix: 'Allocate or match bank lines, or post cash journals, inside the period.',
      },
    ],
    faqs: [
      {
        q: 'Is this the same as Cash vs budget?',
        a: 'No. This is the statutory-style statement. Cash vs budget compares imported bank actuals with the 12-month budget.',
      },
    ],
  }),
  feat({
    id: 'management-cashflow',
    name: 'Cash versus budget',
    href: '/dashboard/accounting/management-cashflow',
    summary: 'Cash versus budget compares imported bank transactions with the 12-month budget.',
    who: WHO_OPEN,
    prerequisites: ['Import or sync bank lines for the period, and publish a budget if you want a plan column.'],
    steps: [
      'Open Cash vs budget from Finance. The title is Management cash flow.',
      'Set the period and press Refresh.',
      'Read actual cash from the imported bank lines against the budget.',
    ],
    behind: [
      'Actuals are imported bank transactions. The statutory statement stays on Cash flow.',
      'Without a published budget the comparison has no plan column.',
    ],
    errors: [
      {
        message: 'No budget loaded for this period.',
        fix: 'Publish the annual budget, then return to this screen.',
      },
    ],
    faqs: [
      {
        q: 'Will unallocated bank lines still count as actual cash?',
        a: 'Imported lines are the actuals on this screen. Allocate them on Bank if you also need them on the correct income or expense account in the profit and loss.',
      },
    ],
  }),
  feat({
    id: 'referrals',
    name: 'Referral commission',
    href: '/dashboard/accounting/referral-commission',
    summary: 'Referral commission shows what a partner company earned on sales they brought in, and what is already paid, offset, or credited.',
    who: WHO_OPEN,
    prerequisites: ['Referral relationships and the sales they relate to must already be on this company.'],
    steps: [
      'Open Referrals from Finance. The title is Referral commission.',
      'Set the period and press Refresh.',
      'Read earned, paid, offset, and credited amounts for each partner.',
    ],
    behind: [
      'The screen reads commission stored for partner companies. It does not calculate a new price and it does not pay the partner.',
    ],
    errors: [
      {
        message: 'Your role (…) cannot access Accounting.',
        fix: 'Open the screen as Owner or Finance.',
      },
    ],
    faqs: [
      {
        q: 'Can I pay the commission from this screen?',
        a: 'No. Record the payment on Payments or on the bank when the money moves. This screen shows the position.',
      },
    ],
  }),
  feat({
    id: 'afs',
    name: 'Annual financial statements',
    href: '/dashboard/accounting/afs',
    summary: 'Annual statements compile the financial position, profit or loss, changes in equity, cash flows, notes, and policies from posted journals. They are not filed from this screen.',
    who: WHO_OPEN,
    prerequisites: ['Posted journals must fall in the period. The default period is the full financial year.'],
    steps: [
      'Open AFS from Finance. The title is Annual financial statements.',
      'Set the period. Read the long IFRS / SA GAAP basis note.',
      'Use the contents: Statement of financial position, Statement of profit or loss, Statement of changes in equity, Statement of cash flows, Notes to the financial statements, and Accounting policies.',
      'The cover says “IFRS / SA GAAP basis — compiled, unaudited”.',
      'Press Refresh to compile again. Press Print / PDF to print the pack in the browser.',
    ],
    behind: [
      'The pack is compiled from posted journals for the dates you set. Drafts are left out.',
      'Impairment, leases, and deferred tax are not calculated. Post journals if they apply. The statements say they are not an audit opinion.',
      'Print / PDF uses the browser print dialog. SupplierAdvisor® does not file the statements with a regulator.',
      'If nothing was posted, the screen says “No statements compiled. Check that the company has posted journals in this period.”',
    ],
    errors: [
      {
        message: 'from and to (YYYY-MM-DD) are required',
        fix: 'Set both dates on the period control. From must be on or before to.',
      },
      {
        message: 'Failed to compile AFS',
        fix: 'Press Refresh. If the period has no posted journals, there is nothing to compile.',
      },
      {
        message: 'No statements compiled. Check that the company has posted journals in this period.',
        fix: 'Widen the dates or post journals, then Refresh.',
      },
    ],
    faqs: [
      {
        q: 'Can I submit these statements from SupplierAdvisor®?',
        a: 'No. Print them and file them in the channel you use. The screen compiles and marks them unaudited. It does not lodge them.',
      },
    ],
  }),
  feat({
    id: 'reports',
    name: 'Reports',
    href: '/dashboard/accounting/reports',
    summary: 'Reports rerun the same posted ledger as the statements, plus forecast, ratios, aging, and budget against actual.',
    who: WHO_OPEN,
    prerequisites: ['Pick a period that contains posted journals, invoices, or a published budget, depending on the tab.'],
    steps: [
      'Open Reports from Finance. The title is Reports & analytics.',
      'Choose a tab: Profit & loss, Balance sheet, Cash flow, Forecast, Ratios, Trends, Budget vs actual, Trial balance, AR aging, AP aging, or Mgmt snapshot.',
      'Set the period. Tick Include pipeline sales (CRM opportunities) only when you want the pipeline added to the sales view. That tick is hidden on Forecast.',
      'Press Refresh. Press Print / PDF to print the tab you are on.',
      'On Ratios, read the footer: ratios are indicative management metrics and not a substitute for the statutory statements.',
    ],
    behind: [
      'Profit and loss, balance sheet, cash flow, trial balance, and management snapshot read posted journals through the report API, which checks accounting view.',
      'AR aging and AP aging read open invoices and bills.',
      'Budget vs actual needs a published budget. Otherwise the tab says “No annual budget in this period.” or “No budget loaded for this period.”',
      'An empty tab says “No rows for this period. Post journals or create invoices to populate reports.” or “No data”. Nothing is invented to fill the grid.',
    ],
    errors: [
      {
        message: 'No rows for this period. Post journals or create invoices to populate reports.',
        fix: 'Change the dates, post a journal, or issue an invoice, then Refresh.',
      },
      {
        message: 'No management data',
        fix: 'The snapshot has no posted activity for that period. Use Management accounts for the same ledger with the period written out.',
      },
    ],
    faqs: [
      {
        q: 'Do reports use a different set of numbers from management accounts?',
        a: 'No. They share the posted ledger. A difference is the period, the pipeline tick, or a tab that also reads invoices or the budget.',
      },
    ],
  }),
  feat({
    id: 'entities',
    name: 'Legal entities',
    href: '/dashboard/accounting/entities',
    summary: 'Legal entities are the companies and associations the books can be split by, including the group you already linked.',
    who: WHO_WRITE,
    prerequisites: ['Group links are maintained under Company → Group. This screen can copy them in. It does not create the group by itself.'],
    steps: [
      'Open Entities from Finance. The title is Legal entities.',
      'Press Company group to open the group screen.',
      'Press Sync from group to create or update entities from active group links. The button shows a count when some links are not synced yet.',
      'Press Add entity to record one that is not in the group.',
    ],
    behind: [
      'Sync copies active group links into legal entities. It does not post a journal and it does not merge ledgers.',
    ],
    errors: [
      {
        message: WRITE_ACCOUNTING,
        fix: 'Owner or Finance must sync or add an entity.',
      },
    ],
    faqs: [
      {
        q: 'Does adding an entity open a second set of books?',
        a: 'It records the entity on this company. Journals stay on the company ledger you have open unless you are working in that entity’s own company.',
      },
    ],
  }),
  feat({
    id: 'settings',
    name: 'Periods and locks',
    href: '/dashboard/accounting/settings',
    summary: 'Settings holds the lock date, month locks, currencies, and document prefixes. VAT registration itself is edited on VAT201.',
    who: `${WHO_OPEN} Saving accounting settings needs accounting write, so Owner or Finance. The lock route allows Owner, Admin, and Finance. The button on the screen is offered to Owner and Finance. Admin is named on the API and is refused by the Finance page guard on the default matrix.`,
    prerequisites: [
      'VAT number, basis, and tax periods are saved on VAT201. This page points you there.',
    ],
    steps: [
      'Open Settings from Finance. The title is Accounting settings.',
      'Read the VAT pointer. Press through to VAT201 to edit the registration.',
      'Under the month list, press a month. The button reads “{YYYY-MM} · Locked” or “{YYYY-MM} · Open”. The heading says “Lock the month (owner / admin / finance only)”.',
      'A locked month rejects a posted journal, a reversal, a reclassification, and a bank allocation.',
      'If your role cannot lock, the banner says “Only owner, admin, or finance can lock or unlock periods. You can still review status below.” The control says “Owner, admin, or finance required”.',
      'Save the other settings with the save button. A view-only role sees “Your role (…) has view-only access to accounting settings.” and the button reads Write access required.',
    ],
    behind: [
      'A month is locked when the lock date is on or after the entry date, or when that YYYY-MM row is locked.',
      'Locking runs a trial-balance check. If it does not balance, the API says “Cannot lock {period}: trial balance does not balance”.',
      'VAT201 review locks each month in the return with the note “Locked by VAT201 review”.',
      'If the lock list cannot be read because the lock table is missing, the screen tells you to apply the period-lock migration. If a lock check cannot run, it does not block a post.',
    ],
    errors: [
      {
        message: 'Cannot lock {period}: trial balance does not balance (Δ …).',
        fix: 'Open the general ledger, find the difference, post the correcting journal, then lock.',
      },
      {
        message: 'Period … is locked — cannot post',
        fix: 'Unlock the month, or post into an open month. A draft can still be saved.',
      },
      {
        message: PERIOD_DENIED,
        fix: 'Use an Owner or Finance login to press the lock button.',
      },
    ],
    faqs: [
      {
        q: 'The lock list is empty and mentions a migration. Did I lose the locks?',
        a: 'The screen says to apply the period-lock migration when the list is empty for that reason. Until the check can run, a post is not blocked by a month lock. The lock date on settings still applies when it is set.',
      },
    ],
  }),
  feat({
    id: 'messages',
    name: 'Finance messages',
    href: '/dashboard/messages?from=accounting&channel=colleague',
    summary: 'Finance messages opens the company inbox on the colleague channel so the finance team can write to each other.',
    who: WHO_OPEN,
    prerequisites: ['You can open Finance, and you can open Messages for this company.'],
    steps: [
      'Open Messages from the Finance sidebar. It is labelled for finance team notes.',
      'Write in the colleague thread. This does not post a journal and does not change a VAT return.',
    ],
    behind: ['The link only sets the inbox channel. The books are unchanged until you use Journals, Bank, or VAT201.'],
    errors: [
      {
        message: 'Your role (…) cannot access Accounting.',
        fix: 'The Finance sidebar, including Messages from that sidebar, follows the accounting permission.',
      },
    ],
    faqs: [
      {
        q: 'Will a message lock a period?',
        a: 'No. Locks are on Settings and on VAT201 review.',
      },
    ],
  }),
];

const OWNER = 'Owner · Finance';
const SYSTEM = 'System';

/** Steps follow the ledger, invoice, bill, bank, and VAT201 paths in this guide. */
const ACCOUNTING_FLOW: GuideNode[] = [
  {
    id: 'chart',
    label: 'Chart',
    hint: 'Accounts and locks',
    icon: 'book-open',
    lane: OWNER,
    anchor: 'chart',
    books: 'Seed writes this company’s standard chart. Totals are posted journals only.',
  },
  {
    id: 'draft',
    label: 'Draft',
    hint: 'Journal, invoice, or bill',
    icon: 'file-pen',
    lane: OWNER,
    anchor: 'journals',
    books: 'Status draft. It does not post, and it need not balance. Void is only for a draft.',
  },
  { id: 'balanced', kind: 'decision', label: 'Balanced?', lane: OWNER, anchor: 'journals' },
  {
    id: 'post',
    label: 'Post',
    hint: 'Status posted',
    icon: 'scale',
    lane: OWNER,
    anchor: 'journals',
    books: 'Source manual. A locked period refuses the post.',
  },
  {
    id: 'invoice',
    label: 'Invoice',
    hint: 'Mark sent',
    icon: 'send',
    lane: OWNER,
    anchor: 'ar',
    books: 'invoice_recognition: Dr 1130, Cr 4100, Cr 2120 when tax is above zero. A receipt before issue credits 2140.',
  },
  { id: 'receipt', kind: 'decision', label: 'Pay or void?', lane: OWNER, anchor: 'ar' },
  {
    id: 'settle',
    label: 'Settle',
    hint: 'Partial or paid',
    icon: 'wallet',
    lane: OWNER,
    anchor: 'ar',
    books: 'invoice_settlement: Dr 1110, Cr AR. Status becomes partial or paid from the amount.',
  },
  {
    id: 'void-invoice',
    label: 'Void',
    hint: 'Reversal',
    icon: 'rotate-ccw',
    lane: OWNER,
    anchor: 'ar',
    books: 'Reverses the recognition, settlement, and deposit journals.',
  },
  {
    id: 'bill',
    label: 'Bill',
    hint: 'Mark sent',
    icon: 'receipt',
    lane: OWNER,
    anchor: 'ap',
    books: 'Mark sent issues the supplier bill.',
  },
  { id: 'po-allocated', kind: 'decision', label: 'On 1140?', lane: SYSTEM, anchor: 'ap' },
  {
    id: 'skip-bill',
    label: 'Skip',
    hint: 'No second cost',
    icon: 'ban',
    lane: SYSTEM,
    anchor: 'ap',
    books: 'Recognition skipped, reason po_already_allocated.',
  },
  {
    id: 'recognise',
    label: 'Recognise',
    hint: 'Cost and input VAT',
    icon: 'receipt',
    lane: SYSTEM,
    anchor: 'ap',
    books: 'Dr 1140, 5100, 1210, or 6990; Dr 1150; Cr AP 2110.',
  },
  {
    id: 'bank',
    label: 'Bank',
    hint: 'Import',
    icon: 'landmark',
    lane: OWNER,
    anchor: 'bank',
    books: 'Statement lines are stored. No money moves.',
  },
  {
    id: 'auto-match',
    label: 'Auto-match',
    hint: 'Confidence 90',
    icon: 'git-branch',
    lane: SYSTEM,
    anchor: 'bank',
    books: 'After import, auto-match runs at a minimum confidence of 90.',
  },
  { id: 'line', kind: 'decision', label: 'Line?', lane: OWNER, anchor: 'bank' },
  {
    id: 'allocate',
    label: 'Allocate',
    hint: 'Post the line',
    icon: 'arrow-left-right',
    lane: OWNER,
    anchor: 'bank',
    books: 'bank_allocation. An inflow debits the bank GL and credits the account.',
  },
  {
    id: 'match',
    label: 'Match & pay',
    hint: 'Invoice or bill',
    icon: 'link-2',
    lane: OWNER,
    anchor: 'bank',
    books: 'invoice_settlement. The line becomes matched invoice and reconciled.',
  },
  {
    id: 'exclude',
    label: 'Exclude',
    hint: 'No journal',
    icon: 'eye-off',
    lane: OWNER,
    anchor: 'bank',
    books: 'No journal. The line is excluded.',
  },
  {
    id: 'vat',
    label: 'VAT worksheet',
    hint: 'Classify',
    icon: 'percent',
    lane: OWNER,
    anchor: 'vat',
    books: 'Output minus input for the period. It does not file a return.',
  },
  {
    id: 'vat201',
    label: 'VAT201',
    hint: 'Copy into eFiling',
    icon: 'clipboard-list',
    lane: OWNER,
    anchor: 'vat201',
    books: 'Built from the posted ledger. SupplierAdvisor® does not submit it.',
  },
  { id: 'review', kind: 'decision', label: 'Review?', lane: OWNER, anchor: 'vat201' },
  {
    id: 'lock',
    label: 'Lock',
    hint: 'Status reviewed',
    icon: 'lock',
    lane: SYSTEM,
    anchor: 'vat201',
    books: 'Status reviewed. Each month is locked: Locked by VAT201 review.',
  },
  {
    id: 'submitted',
    label: 'Record submission',
    hint: 'Status submitted',
    icon: 'stamp',
    lane: OWNER,
    anchor: 'vat201',
    books: 'Status becomes submitted. The return is still not sent to SARS.',
  },
  { id: 'settle-vat', kind: 'decision', label: 'Paid SARS?', lane: OWNER, anchor: 'vat201' },
  {
    id: 'settlement',
    label: 'Settlement',
    hint: 'Status paid',
    icon: 'scale',
    lane: SYSTEM,
    anchor: 'vat201',
    books: 'Clears 1150 and 2120 through 2125 and bank 1110. Status paid.',
  },
  {
    id: 'nil',
    label: 'No settlement',
    hint: 'Nothing to clear',
    icon: 'circle-minus',
    lane: SYSTEM,
    anchor: 'vat201',
    books: 'No net VAT, so no settlement journal is posted.',
  },
  {
    id: 'management',
    label: 'Management',
    hint: 'Posted P&L',
    icon: 'chart-column',
    lane: OWNER,
    anchor: 'management',
    books: 'Reads posted actuals. Compiled and unaudited.',
  },
  {
    id: 'afs',
    label: 'AFS',
    hint: 'Unaudited pack',
    icon: 'files',
    lane: OWNER,
    anchor: 'afs',
    books: 'Annual statements stay unaudited. Nothing is filed from here.',
  },
];

const ACCOUNTING_EDGES: GuideEdge[] = [
  { from: 'chart', to: 'draft' },
  { from: 'draft', to: 'balanced' },
  { from: 'balanced', to: 'post', label: 'Post' },
  { from: 'balanced', to: 'draft', label: 'Save draft' },
  { from: 'post', to: 'invoice' },
  { from: 'invoice', to: 'receipt' },
  { from: 'receipt', to: 'settle', label: 'Record payment' },
  { from: 'receipt', to: 'void-invoice', label: 'Void' },
  { from: 'settle', to: 'bill' },
  { from: 'void-invoice', to: 'bill' },
  { from: 'bill', to: 'po-allocated' },
  { from: 'po-allocated', to: 'skip-bill', label: 'Skip' },
  { from: 'po-allocated', to: 'recognise', label: 'Recognise' },
  { from: 'skip-bill', to: 'bank' },
  { from: 'recognise', to: 'bank' },
  { from: 'bank', to: 'auto-match' },
  { from: 'auto-match', to: 'line' },
  { from: 'line', to: 'allocate', label: 'Allocate' },
  { from: 'line', to: 'match', label: 'Match & pay' },
  { from: 'line', to: 'exclude', label: 'Exclude' },
  { from: 'allocate', to: 'line', label: 'Unallocate' },
  { from: 'match', to: 'line', label: 'Unallocate' },
  { from: 'exclude', to: 'line', label: 'Unexclude' },
  { from: 'allocate', to: 'vat' },
  { from: 'match', to: 'vat' },
  { from: 'exclude', to: 'vat' },
  { from: 'vat', to: 'vat201' },
  { from: 'vat201', to: 'review' },
  { from: 'review', to: 'lock', label: 'Submit to SARS' },
  { from: 'review', to: 'vat201', label: 'Stays draft' },
  { from: 'lock', to: 'submitted' },
  { from: 'submitted', to: 'settle-vat' },
  { from: 'settle-vat', to: 'settlement', label: 'Confirmed' },
  { from: 'settle-vat', to: 'nil', label: 'No VAT to settle' },
  { from: 'settlement', to: 'management' },
  { from: 'nil', to: 'management' },
  { from: 'management', to: 'afs' },
];

export const ACCOUNTING_GUIDE: ModuleGuide = {
  id: 'accounting',
  name: 'Finance',
  href: '/dashboard/accounting',
  purpose:
    'Finance in SupplierAdvisor® is the company ledger. Owner and Finance set the chart, post journals, record customer invoices and supplier bills, import and match the bank, prepare the VAT worksheet, copy the VAT201 into SARS eFiling, and read unaudited management accounts, reports, and annual statements. SupplierAdvisor® records the books. It does not send money, and it does not submit the VAT201.',
  roles: viewRoleLabels('accounting'),
  features,
  faqs: [
    {
      q: 'Finance looks empty. What now?',
      a: 'Nothing has been posted for this company in that period. SupplierAdvisor® does not fill Finance with sample invoices. Seed the chart, post a journal or issue an invoice, or widen the dates.',
    },
    {
      q: 'Who is locked out of Finance?',
      a: 'On the default matrix only Owner and Finance have accounting access. Admin, Member, Viewer, Operations, and Sales see “Your role (…) cannot access Accounting.” A custom permission on the person can override that matrix.',
    },
    {
      q: 'Are the statements audited?',
      a: 'No. Management accounts, the balance sheet, the cash flow, the VAT worksheet, and the annual statements say they are compiled and unaudited. They are not an audit, a review, or an assurance opinion.',
    },
  ],
  flow: ACCOUNTING_FLOW,
  edges: ACCOUNTING_EDGES,
  outcome:
    'The chart is set, journals are posted, invoices and bills are in the ledger, the bank is matched, and the VAT201 and the statements stay unaudited until you file them yourself.',
};
