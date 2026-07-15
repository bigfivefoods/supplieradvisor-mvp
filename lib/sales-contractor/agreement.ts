import {
  DEFAULT_COMMISSION_TIERS,
  MAX_COMMISSION_PCT,
  MIN_COMMISSION_PCT,
  SUPER_LINK_TONNES,
  SUPER_LINK_UNITS,
  SUPER_LINK_UNIT_PRICE_ZAR,
  SUPER_LINK_EXAMPLE_ZAR_PER_TONNE,
  calculateCommission,
  formatZar,
  formatZarPrecise,
  halfSuperLinkDealValue,
  superLinkDealValue,
  tiersSummaryText,
  type CommissionTier,
} from './commission';
import {
  SALES_SUBSCRIPTION_MONTHLY_ZAR,
  SALES_SUBSCRIPTION_TERM_MONTHS,
  SALES_SUBSCRIPTION_TOTAL_ZAR,
} from './subscription';

/** Bump when legal text changes — forces re-sign awareness in UI. */
export const SALES_CONTRACTOR_CONTRACT_VERSION = 'ISC-2026.9-ZA';

export const SALES_CONTRACTOR_CONTRACT_TITLE =
  'Sole Independent Sales Contractor Agreement & Non-Disclosure Undertaking (South Africa)';

/** The only performance KPIs under the sales contractor agreement. */
export const SALES_CONTRACTOR_KPIS = [
  {
    key: 'leadership',
    title: 'Apply the leadership model to your life',
    detail:
      'Actively apply the Super-Cube® leadership model (Choices, Principles, Mental, Emotional, Physical and Spiritual) in personal and professional conduct, complete the Portal leadership training, and demonstrate growth over time.',
  },
  {
    key: 'increase_sales',
    title: 'Increase sales',
    detail:
      'Grow qualifying closed / paid sales of the Company’s products and services in line with authorised pricing, brand standards and Portal workflows.',
  },
  {
    key: 'reduce_costs',
    title: 'Reduce costs',
    detail:
      'Help the Company reduce avoidable cost and waste — including efficient use of tools and travel, accurate quoting, fewer failed deals and rework, and commercial discipline that protects margin.',
  },
] as const;

/** Corporate mailbox allocated after acceptance (Big Five Group domain). */
export const SALES_CONTRACTOR_EMAIL_DOMAIN = 'bigfivegroup.africa';

export {
  SUPER_LINK_TONNES,
  SUPER_LINK_UNITS,
  SUPER_LINK_UNIT_PRICE_ZAR,
  SUPER_LINK_EXAMPLE_ZAR_PER_TONNE,
};

export function superLinkExampleDealValue(): number {
  return superLinkDealValue();
}

export type AgreementDownloadMeta = {
  companyName: string;
  contractorName: string;
  contractVersion?: string | null;
  /** pending | signed */
  status: 'pending' | 'signed';
  signedAt?: string | null;
  signatureName?: string | null;
  signatureEmail?: string | null;
  agreementId?: number | null;
  generatedAt?: string;
};

/**
 * Full standalone HTML document for download / print-to-PDF.
 * Works before acceptance (draft) and after (signed certificate).
 */
export function buildSalesAgreementDownloadDocument(params: {
  bodyHtml: string;
  meta: AgreementDownloadMeta;
}): string {
  const { bodyHtml, meta } = params;
  const generated =
    meta.generatedAt ||
    new Date().toLocaleString('en-ZA', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  const version = meta.contractVersion || SALES_CONTRACTOR_CONTRACT_VERSION;
  const isSigned = meta.status === 'signed';
  const signedBlock = isSigned
    ? `
    <section class="cert">
      <h2>Certificate of electronic acceptance (ECTA)</h2>
      <table>
        <tr><th>Status</th><td><strong>SIGNED / ACCEPTED</strong></td></tr>
        <tr><th>Signatory name</th><td>${escapeHtml(meta.signatureName || meta.contractorName)}</td></tr>
        <tr><th>Signatory email</th><td>${escapeHtml(meta.signatureEmail || '—')}</td></tr>
        <tr><th>Signed at</th><td>${escapeHtml(
          meta.signedAt
            ? new Date(meta.signedAt).toLocaleString('en-ZA', {
                dateStyle: 'full',
                timeStyle: 'medium',
              })
            : '—'
        )}</td></tr>
        <tr><th>Contract version</th><td>${escapeHtml(version)}</td></tr>
        <tr><th>Agreement ID</th><td>${meta.agreementId != null ? String(meta.agreementId) : '—'}</td></tr>
        <tr><th>Company</th><td>${escapeHtml(meta.companyName)}</td></tr>
      </table>
      <p class="note">This document was generated from SupplierAdvisor after electronic acceptance.
      The typed legal name and authentication records constitute the Contractor’s signature under the
      Electronic Communications and Transactions Act 25 of 2002 (ECTA).</p>
    </section>`
    : `
    <section class="cert draft">
      <h2>Document status: NOT YET SIGNED</h2>
      <p>This is a <strong>downloadable copy for review</strong> before acceptance.
      It is not a completed contract until the Contractor accepts electronically in the
      SupplierAdvisor Sales Portal (checkbox + full legal name + secure sign-in).</p>
      <table>
        <tr><th>Proposed contractor</th><td>${escapeHtml(meta.contractorName)}</td></tr>
        <tr><th>Company</th><td>${escapeHtml(meta.companyName)}</td></tr>
        <tr><th>Contract version</th><td>${escapeHtml(version)}</td></tr>
        <tr><th>Generated</th><td>${escapeHtml(generated)}</td></tr>
      </table>
    </section>`;

  return `<!DOCTYPE html>
<html lang="en-ZA">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(SALES_CONTRACTOR_CONTRACT_TITLE)} — ${escapeHtml(meta.companyName)}</title>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      line-height: 1.55;
      font-size: 12.5px;
      max-width: 800px;
      margin: 0 auto;
      padding: 24px 20px 48px;
      background: #fff;
    }
    .masthead {
      border-bottom: 3px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .masthead .brand {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #0077b6;
    }
    .masthead h1 {
      font-size: 18px;
      margin: 8px 0 6px;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }
    .masthead .meta {
      font-size: 11px;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      margin-top: 8px;
    }
    .badge.signed { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
    .badge.draft { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .body-wrap { margin: 16px 0 28px; }
    .body-wrap h2, .body-wrap h3 { page-break-after: avoid; }
    .cert {
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 16px 18px;
      margin-top: 28px;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    .cert.draft { border-color: #d97706; background: #fffbeb; }
    .cert h2 { font-size: 14px; margin: 0 0 10px; }
    .cert table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .cert th {
      text-align: left;
      width: 34%;
      padding: 6px 8px 6px 0;
      color: #64748b;
      font-weight: 600;
      vertical-align: top;
    }
    .cert td { padding: 6px 0; vertical-align: top; }
    .cert .note { font-size: 11px; color: #64748b; margin: 12px 0 0; }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { padding: 0; max-width: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <header class="masthead">
    <div class="brand">SupplierAdvisor® · Sales contractor portal</div>
    <h1>${escapeHtml(SALES_CONTRACTOR_CONTRACT_TITLE)}</h1>
    <div class="meta">
      ${escapeHtml(meta.companyName)} · Version ${escapeHtml(version)} · Generated ${escapeHtml(generated)}
    </div>
    <div class="badge ${isSigned ? 'signed' : 'draft'}">
      ${isSigned ? 'Signed copy' : 'Draft — for review before acceptance'}
    </div>
  </header>

  ${signedBlock}

  <div class="body-wrap">
    ${bodyHtml}
  </div>

  <footer class="footer">
    SupplierAdvisor® · Confidential · Sole agreement &amp; NDA · Governed by the laws of the Republic of South Africa<br/>
    Print this page (Ctrl/Cmd+P) and choose “Save as PDF” if you need a PDF file.
  </footer>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getSalesContractorAgreementHtml(params: {
  contractorName: string;
  companyName: string;
  tiers?: CommissionTier[] | null;
}): string {
  const { contractorName, companyName } = params;
  const tiers = params.tiers?.length ? params.tiers : DEFAULT_COMMISSION_TIERS;
  const date = new Date().toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const tierRows = tiers
    .map((t, i) => {
      const from =
        i === 0
          ? 'R0'
          : `R${Number(tiers[i - 1].upTo || 0).toLocaleString('en-ZA')}`;
      const to =
        t.upTo == null
          ? 'and above'
          : `R${Number(t.upTo).toLocaleString('en-ZA')}`;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${from} – ${to}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0077b6;">${t.ratePct}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;">${t.label || ''}</td>
      </tr>`;
    })
    .join('');

  const linkDeal = superLinkExampleDealValue();
  const linkComm = calculateCommission(linkDeal, { tiers });
  const exampleNameHint = 'name';
  const co = escape(companyName);
  const cn = escape(contractorName || 'the Sales Contractor');

  return `
<div class="space-y-5 text-sm leading-relaxed text-slate-700">
  <!-- Title block (NDA / commercial instrument style) -->
  <div class="rounded-2xl border-2 border-slate-800 bg-slate-50 px-5 py-5 text-center">
    <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Confidential · Legally binding · Republic of South Africa</p>
    <h2 class="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug m-0">
      SOLE INDEPENDENT SALES CONTRACTOR AGREEMENT<br/>
      <span class="text-base font-bold text-slate-700">AND NON-DISCLOSURE UNDERTAKING</span>
    </h2>
    <p class="text-xs text-slate-500 mt-3 mb-0">
      Version <strong>${SALES_CONTRACTOR_CONTRACT_VERSION}</strong> · Effective ${date}<br/>
      <strong>This is the only agreement</strong> between the Parties on this subject matter.
    </p>
  </div>

  <div class="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950">
    <strong>Important:</strong> By accepting electronically you confirm this document is the
    <strong>sole and entire agreement</strong> governing your independent sales engagement, confidentiality
    (NDA), commission, portal access and corporate email. No other oral or written promise applies unless
    recorded in a written instrument signed by an authorised Company representative that expressly amends this Agreement.
  </div>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">A. PARTIES</h3>
  <p><strong>THIS AGREEMENT</strong> is entered into between:</p>
  <ol class="list-decimal pl-5 space-y-2">
    <li>
      <strong>${co}</strong> (the “<strong>Company</strong>” / “<strong>Disclosing Party</strong>” for Confidential Information),
      a business operating in the Republic of South Africa, acting through its authorised representatives; and
    </li>
    <li>
      <strong>${cn}</strong> (the “<strong>Contractor</strong>” / “<strong>Receiving Party</strong>” for Confidential Information),
      an independent contractor for the purposes of this Agreement.
    </li>
  </ol>
  <p>The Company and the Contractor are each a “<strong>Party</strong>” and together the “<strong>Parties</strong>”.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">B. RECITALS</h3>
  <p><strong>WHEREAS</strong> the Company wishes to appoint independent sales contractors to promote and sell its products and services through the SupplierAdvisor Sales Contractor Portal;</p>
  <p><strong>WHEREAS</strong> the Contractor wishes to accept that appointment on a commission basis and will receive access to Confidential Information, customer data, pricing and systems belonging to the Company;</p>
  <p><strong>WHEREAS</strong> the Parties intend this instrument to be the <strong>only agreement</strong> between them regarding the engagement, to include a binding non-disclosure undertaking, and to protect the Company’s business, brand, data and goodwill while remaining fair to the Contractor;</p>
  <p><strong>NOW THEREFORE</strong> the Parties agree as follows:</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">1. DEFINITIONS &amp; INTERPRETATION</h3>
  <p>1.1 In this Agreement, unless the context requires otherwise:</p>
  <ul class="list-disc pl-5 space-y-1.5">
    <li><strong>“Agreement”</strong> means this Sole Independent Sales Contractor Agreement and Non-Disclosure Undertaking, including its schedules and electronic acceptance records, as amended only in writing signed by the Company.</li>
    <li><strong>“Confidential Information”</strong> means all non-public information of the Company or its affiliates (whether commercial, technical, financial, operational or personal), including customer and prospect lists, leads, CRM records, pricing, margins, commission structures, product formulations and roadmaps, supplier terms, strategies, forecasts, passwords, portal data, documents marked confidential, and any information a reasonable person would understand to be confidential. It includes information disclosed before or after the Effective Date.</li>
    <li><strong>“Customer Data”</strong> means all leads, opportunities, customers, quotes, orders, invoices, documents and related records created, captured or managed in connection with the Services.</li>
    <li><strong>“Effective Date”</strong> means the date of electronic acceptance under clause 16.</li>
    <li><strong>“Portal”</strong> means the SupplierAdvisor Sales Contractor Portal and related systems.</li>
    <li><strong>“Services”</strong> means the sales and related activities in clause 4.</li>
    <li><strong>“KPIs”</strong> means the three performance measures in clause 4A only — leadership, increase sales, and reduce costs. No other performance KPIs apply under this Agreement unless added by a written variation under clause 2.3.</li>
    <li><strong>“Leadership Model”</strong> means the Super-Cube® multidimensional leadership model made available in the Portal (and related Company training).</li>
    <li><strong>“Super-link”</strong> means, for commission examples only, approximately ${SUPER_LINK_UNITS.toLocaleString('en-ZA')} units of finished goods (≈ ${SUPER_LINK_TONNES} t payload class).</li>
  </ul>
  <p>1.2 Headings are for convenience only. “Including” means “including without limitation”. “R” / “ZAR” means South African Rand. Singular includes plural and vice versa.</p>
  <p>1.3 This Agreement is governed by the laws of the <strong>Republic of South Africa</strong>. The Parties submit to the non-exclusive jurisdiction of the South African courts (and the CCMA where lawfully required).</p>
  <p>1.4 Nothing excludes rights that cannot lawfully be excluded, including under the Constitution, the Consumer Protection Act 68 of 2008 (where applicable), POPIA and ECTA.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">2. SOLE AND ENTIRE AGREEMENT</h3>
  <p>2.1 <strong>This is the only agreement</strong> between the Parties concerning the Contractor’s appointment as an independent sales contractor, access to the Portal, commission, corporate email, Confidential Information and related obligations.</p>
  <p>2.2 This Agreement <strong>supersedes and replaces</strong> all prior and contemporaneous negotiations, representations, warranties, promises, term sheets, WhatsApp or email “side deals”, and draft agreements relating to the same subject matter, whether oral or written.</p>
  <p>2.3 <strong>No other terms apply</strong> unless set out in a written instrument that: (a) is signed (or e-signed) by an authorised Company representative; (b) expressly states that it amends this Agreement; and (c) identifies the clause being varied. Informal messages do not amend this Agreement.</p>
  <p>2.4 The Contractor acknowledges they have not relied on any representation not set out in this Agreement (save for fraud).</p>
  <p>2.5 If there is any conflict between Portal UI help text and this Agreement, <strong>this Agreement prevails</strong>.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">3. NATURE OF RELATIONSHIP (INDEPENDENT CONTRACTOR)</h3>
  <p>3.1 The Contractor is engaged as an <strong>independent sales contractor</strong>, not as an employee, partner, joint venturer or permanent agent of the Company.</p>
  <p>3.2 Without limiting clause 3.1:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>the Contractor controls the manner, method and hours of the Services, subject to lawful Company policies, brand standards and Portal rules;</li>
    <li>the Contractor may use their own tools and devices (except systems the Company requires);</li>
    <li>the Contractor may work for other principals only if that does not create a conflict of interest or misuse Confidential Information;</li>
    <li>the Contractor is not entitled to employee benefits under the Basic Conditions of Employment Act 75 of 1997, paid employee leave, or automatic UIF as an employee, unless a competent authority or court later determines otherwise.</li>
  </ul>
  <p>3.3 The Contractor may not bind the Company except through quotations and workflows expressly authorised in the Portal or in writing by the Company.</p>
  <p>3.4 The Contractor is solely responsible for income tax and SARS filings (including provisional tax where applicable); VAT if registered or required; reasonable insurance; and compliance with the Prevention and Combating of Corrupt Activities Act 12 of 2004 and anti-money-laundering laws.</p>
  <p>3.5 If the relationship is recharacterised as employment, the Parties will co-operate in good faith on statutory compliance; recharacterisation does <strong>not</strong> transfer ownership of Customer Data or Confidential Information to the Contractor.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">4. APPOINTMENT &amp; SCOPE OF SERVICES</h3>
  <p>4.1 The Company appoints the Contractor, and the Contractor accepts, to promote and sell the Company’s products and services using the Portal, including: capturing and nurturing leads; onboarding customers into the Company’s CRM; preparing quotations; progressing orders; supporting collections workflows; representing the Company lawfully and professionally; and completing leadership and product training as reasonably required.</p>
  <p>4.2 The Contractor must not make false, misleading or unauthorised claims about price, product, delivery or financing (including under the Consumer Protection Act where consumers are involved).</p>
  <p>4.3 The Company may set territories, product lines, discount limits and approval rules. The Company may reject deals that breach policy, law or brand standards.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">4A. PERFORMANCE KPIs (THE ONLY KPIs)</h3>
  <p>4A.1 The Parties agree that the Contractor’s performance under this Agreement is measured solely against the following <strong>three (3) KPIs</strong>. <strong>These are the only KPIs.</strong> No other scorecard, ranking, quota grid, or informal target constitutes a contractual KPI unless added by a written variation under clause 2.3.</p>
  <div class="overflow-x-auto my-3 rounded-xl border border-slate-800">
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="bg-slate-900 text-white text-xs uppercase tracking-wide">
          <th class="px-3 py-2.5 w-12">#</th>
          <th class="px-3 py-2.5">KPI</th>
          <th class="px-3 py-2.5">What it means</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b border-slate-200 bg-white">
          <td class="px-3 py-3 font-black text-[#00b4d8]">1</td>
          <td class="px-3 py-3 font-bold text-slate-900">Apply the leadership model to your life</td>
          <td class="px-3 py-3 text-slate-600">Actively apply the Super-Cube® Leadership Model in personal and professional conduct; complete Portal leadership training; and show ongoing growth across the six faces (Choices, Principles, Mental, Emotional, Physical, Spiritual).</td>
        </tr>
        <tr class="border-b border-slate-200 bg-slate-50">
          <td class="px-3 py-3 font-black text-[#00b4d8]">2</td>
          <td class="px-3 py-3 font-bold text-slate-900">Increase sales</td>
          <td class="px-3 py-3 text-slate-600">Grow qualifying closed / paid sales of the Company’s products and services through authorised pricing, brand standards and Portal workflows.</td>
        </tr>
        <tr class="bg-white">
          <td class="px-3 py-3 font-black text-[#00b4d8]">3</td>
          <td class="px-3 py-3 font-bold text-slate-900">Reduce costs</td>
          <td class="px-3 py-3 text-slate-600">Help reduce avoidable cost and waste — efficient use of time and tools, accurate quoting, fewer failed deals and rework, and commercial discipline that protects the Company’s margin.</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>4A.2 The Company may review progress against these three KPIs in good faith (including via Portal activity, paid invoices, leadership training progress, and reasonable discussions). KPI reviews are for alignment and development; they do not create employment, guaranteed earnings, or automatic termination, but serious, sustained failure on the KPIs after fair notice may be treated as material breach under clause 14.</p>
  <p>4A.3 Commission remains as set out in clause 10. KPIs guide behaviour and priorities; they do not replace the commission schedule unless the Parties expressly agree otherwise in writing under clause 2.3.</p>
  <p>4A.4 No manager, message or dashboard may invent additional contractual KPIs. Operational tips and coaching are welcome; only the three KPIs above are binding performance measures under this Agreement.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">5. NON-DISCLOSURE AGREEMENT (CONFIDENTIALITY)</h3>
  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">This clause operates as a mutual NDA for Company Confidential Information disclosed to the Contractor, and is a material term of the engagement.</p>
  <p>5.1 The Contractor acknowledges that in performing the Services they will receive Confidential Information and that unauthorised use or disclosure would cause serious harm to the Company.</p>
  <p>5.2 The Contractor undertakes to the Company that they will:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>hold Confidential Information in strict confidence and use it <strong>only</strong> for performing the Services;</li>
    <li>not disclose Confidential Information to any third party without the Company’s prior written consent, except to professional advisers under a duty of confidence or as required by law (with prior notice to the Company where lawful);</li>
    <li>not copy, reverse-engineer or commercially exploit Confidential Information for their own or any third party’s benefit;</li>
    <li>apply at least the same care as for their own confidential information, and no less than reasonable care;</li>
    <li>promptly notify the Company of any actual or suspected breach or unauthorised access; and</li>
    <li>on request or on termination, return or securely destroy Confidential Information (except copies required by law or automated backups that cannot practically be deleted, which remain subject to this clause).</li>
  </ul>
  <p>5.3 Confidential Information does <strong>not</strong> include information that the Contractor can prove: (a) is or becomes public other than by breach; (b) was lawfully known to the Contractor before disclosure without duty of confidence; (c) is independently developed without use of Confidential Information; or (d) is received from a third party free to disclose it.</p>
  <p>5.4 Obligations under this clause 5 survive termination for <strong>five (5) years</strong>, and indefinitely for trade secrets and personal information for as long as law requires.</p>
  <p>5.5 The Company may seek <strong>interdictory relief</strong> (without prejudice to damages) for threatened or actual breach of this clause, and the Contractor agrees damages alone may be an inadequate remedy.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">6. OWNERSHIP OF DATA, IP &amp; CUSTOMER RELATIONSHIPS</h3>
  <p>6.1 All Customer Data and all work product created in the course of the Services is and remains the <strong>exclusive property of the Company</strong>.</p>
  <p>6.2 The Contractor acquires <strong>no ownership</strong> of customers, leads or goodwill introduced through this engagement. Introductions do not create a personal book of business unless the Company agrees in a written instrument under clause 2.3.</p>
  <p>6.3 Company trade marks, logos, content and software remain Company (or licensor) property. The Contractor receives a limited, revocable licence to use brand materials only as authorised and only while this Agreement is in force.</p>
  <p>6.4 The Contractor assigns to the Company (and agrees to execute further documents if needed) any rights they might claim in Customer Data or materials created for the Company under the Services.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">7. POPIA (PERSONAL INFORMATION)</h3>
  <p>7.1 The Company is the <strong>responsible party</strong> and the Contractor is an <strong>operator</strong> under POPIA when processing personal information for the Services.</p>
  <p>7.2 The Contractor must process personal information only on the Company’s instructions and for the Services; keep it secure and confidential; not engage sub-processors without consent; assist with data subject requests and incidents; and not retain personal information after termination except as law requires.</p>
  <p>7.3 The Contractor must notify the Company without undue delay after becoming aware of a personal information breach.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">8. CORPORATE EMAIL (@${SALES_CONTRACTOR_EMAIL_DOMAIN})</h3>
  <p>8.1 <strong>On acceptance of this Agreement</strong>, the Company will allocate a corporate mailbox on
  <strong>@${SALES_CONTRACTOR_EMAIL_DOMAIN}</strong> (e.g. <strong>${exampleNameHint}@${SALES_CONTRACTOR_EMAIL_DOMAIN}</strong> or a close variant).</p>
  <p>8.2 The mailbox and systems remain Company / Big Five Group property. Use is limited to authorised sales and operations. Credentials must not be shared. POPIA and IT/security policies apply. Mailbox content may be monitored for legitimate business, security and compliance purposes as permitted by law.</p>
  <p>8.3 On termination or suspension, the Company may revoke, redirect or archive the mailbox immediately. The Contractor must not use the address thereafter.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">9. PLATFORM SUBSCRIPTION</h3>
  <p>9.1 Portal access requires an active subscription of <strong>R${SALES_SUBSCRIPTION_MONTHLY_ZAR} per month</strong> for a
  <strong>${SALES_SUBSCRIPTION_TERM_MONTHS}-month</strong> term (total
  <strong>R${SALES_SUBSCRIPTION_TOTAL_ZAR.toLocaleString('en-ZA')}</strong> prepaid via Paystack or the platform’s provider).</p>
  <p>9.2 The subscription is payable by the Contractor to the platform provider and is <strong>separate from commission</strong> paid by the Company.</p>
  <p>9.3 Fees already paid are non-refundable except where required by the Consumer Protection Act or other applicable law, or the platform’s published refund policy.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">10. COMMISSION (4% · 5% · 6% — FULL SUPER-LINK AT 6%)</h3>
  <p>10.1 Commission is calculated on qualifying closed / paid deal value (ZAR) on a <strong>stepped scale</strong> (whole deal at one rate), worked backwards from a full super-link load at <strong>${MAX_COMMISSION_PCT}%</strong>:</p>
  <div class="overflow-x-auto my-3 rounded-xl border border-slate-200">
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <th class="px-3 py-2">Deal size (ZAR, illustrative)</th>
          <th class="px-3 py-2">Rate on whole deal</th>
          <th class="px-3 py-2">Tier</th>
        </tr>
      </thead>
      <tbody>${tierRows}</tbody>
    </table>
  </div>
  <p>10.2 <strong>Earned commission</strong> accrues when an invoice is marked paid (or as the Company configures). Payouts are subject to Company approval, clawback for cancellations, credit notes or refunds, and tax law (including tax invoices if the Contractor is a VAT vendor). Portal projections are estimates only.</p>
  <p class="text-xs text-neutral-500">Scale summary: ${escape(tiersSummaryText(tiers))}</p>
  <p class="text-xs text-neutral-500">Illustrative bands: ½ link ${formatZar(halfSuperLinkDealValue())}; full link ${formatZar(linkDeal)} (${SUPER_LINK_UNITS.toLocaleString('en-ZA')} units × ${formatZar(SUPER_LINK_UNIT_PRICE_ZAR)} ≈ R1.5m). Live catalogue prices may differ; rates remain 4% / 5% / 6% with a full link at 6%.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">11. WORKED EXAMPLE — SUPER-LINK (~R1.5m) AT 6%</h3>
  <p>11.1 For illustration only: one super-link ≈ <strong>${SUPER_LINK_UNITS.toLocaleString('en-ZA')} finished-goods units</strong> (~${SUPER_LINK_TONNES} t class) at <strong>${formatZar(SUPER_LINK_UNIT_PRICE_ZAR)} each</strong>:</p>
  <p class="font-semibold text-slate-900 pl-3 border-l-4 border-[#00b4d8] my-2">
    ${SUPER_LINK_UNITS.toLocaleString('en-ZA')} × ${formatZar(SUPER_LINK_UNIT_PRICE_ZAR)} =
    <strong>${formatZar(linkDeal)}</strong>
    <span class="font-normal text-slate-500"> (approx. R1.5 million)</span>
  </p>
  <p>11.2 Commission on that deal at <strong>${MAX_COMMISSION_PCT}%</strong> =
  <strong>${formatZarPrecise(linkComm.commissionAmount)}</strong>.</p>
  <p>11.3 Working backwards: under ½ link → <strong>4%</strong>; ½ to under 1 full link → <strong>5%</strong>; full super-link and above → <strong>6%</strong> on the whole deal.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">12. NON-SOLICITATION, NON-CIRCUMVENTION &amp; FAIR RESTRAINT</h3>
  <p>12.1 During the term and for <strong>twelve (12) months</strong> after termination, the Contractor must not, directly or indirectly, for their own account or for any competitor:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>solicit or entice away customers or active prospects of the Company with whom the Contractor had material dealings in the twelve months before termination, for competing products or services; or</li>
    <li>solicit the Company’s employees or other contractors to leave for a competitor; or</li>
    <li>circumvent the Company by closing with a Company customer introduced via this engagement so as to avoid commission rules or Company invoicing, without the Company’s written consent.</li>
  </ul>
  <p>12.2 The Parties agree these restraints are reasonable to protect Confidential Information, Customer Data and goodwill. If a court finds any restraint too wide, it must be read down to the maximum enforceable extent (severability).</p>
  <p>12.3 Nothing prevents the Contractor from working in their profession generally, or from dealing with customers who approach them independently without use of Confidential Information, subject to clauses 5 and 6.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">13. CONDUCT &amp; BRAND</h3>
  <p>13.1 No misrepresentation, discrimination, bribery, kickbacks or unlawful practices. Site visits require compliance with health and safety law. Brand use only as authorised.</p>
  <p>13.2 The Contractor must not disparage the Company in bad faith; honest feedback through internal channels is encouraged.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">14. TERM, SUSPENSION &amp; TERMINATION</h3>
  <p>14.1 This Agreement starts on the Effective Date and continues until terminated by either Party on reasonable written notice (email suffices), or immediately for material breach, fraud, confidentiality or POPIA breach, or unlawful conduct.</p>
  <p>14.2 The Company may suspend Portal or email access pending investigation of suspected material breach.</p>
  <p>14.3 On termination the Contractor must: stop selling for the Company; stop using @${SALES_CONTRACTOR_EMAIL_DOMAIN} and Company materials; return credentials and property; and confirm destruction of Confidential Information on request.</p>
  <p>14.4 Survival: clauses 2, 5, 6, 7, 10.2 (clawback), 12, 15, 16 and 17 survive termination.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">15. LIABILITY &amp; INDEMNITY (BALANCED)</h3>
  <p>15.1 Subject to clause 15.3, neither Party is liable to the other for indirect or consequential loss (including loss of profit or opportunity), except for gross negligence or wilful misconduct.</p>
  <p>15.2 The Contractor indemnifies the Company against third-party claims arising from the Contractor’s fraud, unlawful statements to customers, or processing of personal information outside the Company’s instructions, except to the extent caused by the Company.</p>
  <p>15.3 Nothing excludes liability for death or personal injury caused by negligence where exclusion is unlawful, fraud, or any other liability that cannot be limited under South African law.</p>
  <p>15.4 The Company’s aggregate liability under this Agreement in any twelve-month period is limited to the greater of (a) commission actually paid to the Contractor in that period and (b) R10 000, except for fraud, gross negligence or wilful misconduct, or amounts that cannot lawfully be limited.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">16. ELECTRONIC ACCEPTANCE (ECTA)</h3>
  <p>16.1 By selecting “I have read and agree”, typing their full legal name, and authenticating, the Contractor:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>confirms they have read and understood this entire Agreement (version <strong>${SALES_CONTRACTOR_CONTRACT_VERSION}</strong>);</li>
    <li>agrees this is the <strong>sole agreement</strong> (clause 2) and a binding <strong>NDA</strong> (clause 5);</li>
    <li>accepts appointment as an independent sales contractor;</li>
    <li>accepts that the <strong>only KPIs</strong> are: (1) apply the leadership model to your life; (2) increase sales; (3) reduce costs (clause 4A);</li>
    <li>accepts commission 4% · 5% · 6% (super-link ~R1.5m at 6%), portal subscription, and @${SALES_CONTRACTOR_EMAIL_DOMAIN} mailbox rules;</li>
    <li>intends this e-signature to have the same effect as a handwritten signature under ECTA.</li>
  </ul>
  <p>16.2 The Company may retain audit logs (timestamp, identity, IP/user agent where available) as evidence of acceptance.</p>

  <h3 class="font-bold text-slate-900 text-base pt-1 border-b border-slate-200 pb-1">17. GENERAL</h3>
  <p>17.1 <strong>Entire agreement:</strong> as set out in clause 2 — this is the only agreement on this subject matter.</p>
  <p>17.2 <strong>Severability:</strong> if any provision is unenforceable, it is severed or read down to the minimum extent; the rest remains in force.</p>
  <p>17.3 <strong>Waiver:</strong> no waiver is effective unless in writing. Delay in enforcement is not a waiver.</p>
  <p>17.4 <strong>Cession:</strong> the Contractor may not cede or assign without the Company’s prior written consent. The Company may cede to an affiliate on written notice.</p>
  <p>17.5 <strong>Notices:</strong> email to the addresses on record (including the allocated @${SALES_CONTRACTOR_EMAIL_DOMAIN} mailbox once issued) is sufficient written notice.</p>
  <p>17.6 <strong>Counterparts / e-sign:</strong> electronic counterparts and signatures are valid.</p>
  <p>17.7 <strong>Relationship to fairness:</strong> the Parties intend a commercially fair bargain: the Contractor earns transparent commission and tools to sell; the Company protects its Confidential Information, Customer Data, brand and revenue integrity.</p>

  <div class="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 mt-4 text-xs text-slate-600">
    <p class="font-bold text-slate-800 mb-2">EXECUTION BLOCK (ELECTRONIC)</p>
    <p class="mb-1"><strong>Company:</strong> ${co}</p>
    <p class="mb-1"><strong>Contractor (signatory):</strong> ${cn}</p>
    <p class="mb-1"><strong>Document:</strong> ${escape(SALES_CONTRACTOR_CONTRACT_TITLE)}</p>
    <p class="mb-0"><strong>Version:</strong> ${SALES_CONTRACTOR_CONTRACT_VERSION} · <strong>Date:</strong> ${date}</p>
    <p class="mt-3 mb-0 italic">Signed by the Contractor typing their full legal name and confirming acceptance in the Portal; logged under ECTA.</p>
  </div>
</div>
`.trim();
}

function escape(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function salesContractorInviteEmailHtml(params: {
  inviteeName?: string | null;
  companyName: string;
  invitedBy: string;
  inviteLink: string;
}): string {
  const { inviteeName, companyName, invitedBy, inviteLink } = params;
  const linkDeal = superLinkExampleDealValue();
  const linkComm = calculateCommission(linkDeal);
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#f59e0b 0%,#ea580c 45%,#00b4d8 100%);padding:40px 36px;color:#fff;">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.95;">SupplierAdvisor® · Customer sales team · South Africa</div>
      <h1 style="margin:12px 0 0;font-size:28px;font-weight:900;letter-spacing:-0.6px;line-height:1.15;">
        You're invited to sell with ${escape(companyName)}
      </h1>
      <p style="margin:14px 0 0;font-size:15px;opacity:.95;line-height:1.6;max-width:480px;">
        Join as an <strong>Independent Sales Contractor</strong> under South African law — commission
        <strong>4% · 5% · 6%</strong> (super-link loads at <strong>6%</strong>), a corporate mailbox on <strong>@${SALES_CONTRACTOR_EMAIL_DOMAIN}</strong> after you accept, and a portal for leads, customers, quotes and earnings.
      </p>
    </div>
    <div style="padding:36px 36px 28px;color:#334155;font-size:16px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hello${inviteeName ? ` ${escape(inviteeName)}` : ''},</p>
      <p style="margin:0 0 16px;">
        <strong>${escape(invitedBy)}</strong> has invited you to the customer sales team at
        <strong>${escape(companyName)}</strong>.
      </p>
      <div style="background:linear-gradient(180deg,#fff7ed,#f8fafc);border:1px solid #fed7aa;border-radius:16px;padding:18px 20px;margin:0 0 22px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c2410c;margin-bottom:8px;">Your portal includes</div>
        <ul style="margin:0;padding-left:18px;color:#475569;font-size:14px;">
          <li style="margin-bottom:6px;">Independent Sales Contractor Agreement (SA law · ECTA e-signature)</li>
          <li style="margin-bottom:6px;">Company email: <strong>you@${SALES_CONTRACTOR_EMAIL_DOMAIN}</strong> after acceptance</li>
          <li style="margin-bottom:6px;">Platform access: <strong>R${SALES_SUBSCRIPTION_MONTHLY_ZAR}/month</strong> · ${SALES_SUBSCRIPTION_TERM_MONTHS}-month subscription (R${SALES_SUBSCRIPTION_TOTAL_ZAR} prepaid)</li>
          <li style="margin-bottom:6px;">Commission <strong>4% · 5% · 6%</strong> — full super-link (~R1.5m) at <strong>6%</strong></li>
          <li style="margin-bottom:6px;">Example: ${SUPER_LINK_UNITS.toLocaleString('en-ZA')} units × R${SUPER_LINK_UNIT_PRICE_ZAR} = ${formatZar(linkDeal)} → commission ${formatZarPrecise(linkComm.commissionAmount)} at 6%</li>
          <li>All customer data saved under ${escape(companyName)} (POPIA)</li>
        </ul>
      </div>
      <div style="text-align:center;margin:28px 0 20px;">
        <a href="${inviteLink}" style="background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;padding:16px 36px;border-radius:9999px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;box-shadow:0 10px 30px rgba(234,88,12,.35);">
          Join the sales team →
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;text-align:center;">
        Link expires in 14 days · Secure sign-in required · Portal subscription via Paystack
      </p>
    </div>
    <div style="background:#f8fafc;padding:18px 36px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;">
      SupplierAdvisor® · Independent contractors · Company-owned CRM · Commission 4%–6% (super-link 6%) · @${SALES_CONTRACTOR_EMAIL_DOMAIN}
    </div>
  </div>
</body>
</html>`;
}
