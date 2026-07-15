import {
  DEFAULT_COMMISSION_TIERS,
  MAX_COMMISSION_PCT,
  MIN_COMMISSION_PCT,
  SUPER_LINK_TONNES,
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
export const SALES_CONTRACTOR_CONTRACT_VERSION = 'ISC-2026.6-ZA';

export const SALES_CONTRACTOR_CONTRACT_TITLE =
  'Independent Sales Contractor Agreement (South Africa)';

/** Corporate mailbox allocated after acceptance (Big Five Group domain). */
export const SALES_CONTRACTOR_EMAIL_DOMAIN = 'bigfivegroup.africa';

export {
  SUPER_LINK_TONNES,
  SUPER_LINK_EXAMPLE_ZAR_PER_TONNE,
};

export function superLinkExampleDealValue(): number {
  return superLinkDealValue();
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

  return `
<div class="space-y-4 text-sm leading-relaxed text-slate-700">
  <p class="text-xs text-neutral-500">Version ${SALES_CONTRACTOR_CONTRACT_VERSION} · Effective ${date} · Governed by the laws of the Republic of South Africa</p>

  <p><strong>Between:</strong></p>
  <ol class="list-decimal pl-5 space-y-1">
    <li><em>${escape(companyName)}</em> (the “<strong>Company</strong>”), acting through its authorised representatives; and</li>
    <li><em>${escape(contractorName || 'the Sales Contractor')}</em> (the “<strong>Contractor</strong>”), an independent contractor for the purposes of this Agreement.</li>
  </ol>
  <p>Together the “<strong>Parties</strong>” and each a “<strong>Party</strong>”.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">1. Interpretation &amp; South African law</h3>
  <p>1.1 This Agreement is governed by the laws of the <strong>Republic of South Africa</strong>. The Parties submit to the non-exclusive jurisdiction of the South African courts (and, where applicable, the Commission for Conciliation, Mediation and Arbitration for any dispute that is lawfully required to be dealt with there).</p>
  <p>1.2 Headings are for convenience only. References to “including” mean “including without limitation”. Amounts in “R” or “ZAR” mean South African Rand.</p>
  <p>1.3 Nothing in this Agreement is intended to exclude, limit or avoid any right or remedy that cannot lawfully be excluded under South African law, including the <em>Constitution of the Republic of South Africa, 1996</em>, the <em>Consumer Protection Act 68 of 2008</em> (where applicable), the <em>Protection of Personal Information Act 4 of 2013</em> (“POPIA”), and the <em>Electronic Communications and Transactions Act 25 of 2002</em> (“ECTA”).</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">2. Nature of relationship (independent contractor)</h3>
  <p>2.1 The Contractor is engaged as an <strong>independent sales contractor</strong> and not as an employee of the Company. The Parties intend a genuine independent contracting relationship. Without limiting the foregoing:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>the Contractor is free to determine the manner, method and hours of performing sales activities, subject to lawful Company policies, brand standards and platform rules;</li>
    <li>the Contractor may supply their own tools and communications devices (save for systems the Company requires them to use);</li>
    <li>the Contractor may render services to other principals provided this does not create a conflict of interest or misuse Company confidential information;</li>
    <li>the Contractor is not entitled to employee benefits under the <em>Basic Conditions of Employment Act 75 of 1997</em>, paid leave as an employee, or automatic UIF contributions as an employee, unless a competent authority or court later determines otherwise.</li>
  </ul>
  <p>2.2 Nothing in this Agreement creates a partnership, joint venture, employment relationship, or permanent agency with authority to bind the Company beyond quotations and workflows expressly authorised in the SupplierAdvisor Sales Contractor Portal (or in writing by the Company).</p>
  <p>2.3 The Contractor remains solely responsible for:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li><strong>Income tax</strong> and related filings with the South African Revenue Service (SARS), including provisional tax where applicable;</li>
    <li><strong>VAT</strong> registration and output/input VAT if the Contractor’s taxable supplies meet or exceed the statutory threshold (or if voluntarily registered);</li>
    <li>any professional indemnity, public liability or other insurance the Contractor reasonably requires;</li>
    <li>compliance with the <em>Prevention and Combating of Corrupt Activities Act 12 of 2004</em> and all anti-bribery and anti-money-laundering laws.</li>
  </ul>
  <p>2.4 If any competent authority recharacterises the relationship as employment, the Parties will co-operate in good faith to regularise statutory compliance; recharacterisation does not of itself transfer ownership of Company CRM data to the Contractor.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">3. Appointment &amp; scope of services</h3>
  <p>3.1 The Company appoints the Contractor to promote and sell the Company’s products and services using the SupplierAdvisor Sales Contractor Portal, including:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>capturing and nurturing leads and opportunities;</li>
    <li>onboarding customers into the Company’s CRM (all records belong to the Company);</li>
    <li>preparing quotations, progressing orders, and supporting invoice collection workflows;</li>
    <li>representing the Company professionally, accurately and lawfully in the market;</li>
    <li>completing leadership and product training as reasonably required by the Company.</li>
  </ul>
  <p>3.2 The Contractor must not make product, pricing, delivery or financing claims that are false, misleading or not authorised by the Company (including under the Consumer Protection Act where consumers are involved).</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">4. Company email address (Big Five Group)</h3>
  <p>4.1 <strong>On acceptance of this Agreement</strong> (electronic signature as set out below), the Company will allocate the Contractor a corporate mailbox on the domain
  <strong>@${SALES_CONTRACTOR_EMAIL_DOMAIN}</strong> in the form
  <strong>${exampleNameHint}@${SALES_CONTRACTOR_EMAIL_DOMAIN}</strong> (or a close variant if the preferred local-part is unavailable).</p>
  <p>4.2 The email address and all related systems remain the property of the Company / Big Five Group (as applicable). The Contractor must use it only for authorised Company sales and operations, must not share credentials, and must comply with POPIA and Company IT/security policies.</p>
  <p>4.3 On termination or suspension of this engagement, the Company may revoke, redirect or archive the mailbox immediately. The Contractor must not continue to use the address or hold themselves out as authorised after access ends.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">5. Company ownership of data &amp; POPIA</h3>
  <p>5.1 All leads, customers, quotes, orders, invoices, documents and related CRM data created or managed by the Contractor are the <strong>exclusive property of the Company</strong>.</p>
  <p>5.2 The Contractor is a <strong>operator</strong> (as contemplated in POPIA) processing personal information on behalf of the Company as responsible party, solely for performing services under this Agreement. The Contractor must:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>process personal information only on documented instructions of the Company and for sales duties;</li>
    <li>keep information confidential and secure;</li>
    <li>not retain copies after termination except where law requires;</li>
    <li>promptly notify the Company of any personal information breach of which they become aware.</li>
  </ul>
  <p>5.3 Credentials must not be shared. On termination, access ends and the Contractor retains no ownership of customer relationships introduced through this engagement unless agreed in a signed written instrument.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">6. Platform subscription (SupplierAdvisor)</h3>
  <p>6.1 Access to the Sales Contractor Portal requires an active platform subscription of
  <strong>R${SALES_SUBSCRIPTION_MONTHLY_ZAR} per month</strong>, billed as a
  <strong>${SALES_SUBSCRIPTION_TERM_MONTHS}-month</strong> term
  (total <strong>R${SALES_SUBSCRIPTION_TOTAL_ZAR.toLocaleString('en-ZA')}</strong> prepaid via Paystack or such other payment provider as the platform uses).</p>
  <p>6.2 Portal features (pipeline tools, commission tracking, forecasts, training) are available only while the subscription is active. The subscription is payable by the Contractor to the platform provider and is <strong>separate from commission</strong> paid by the Company on closed deals.</p>
  <p>6.3 Platform fees already paid are non-refundable except where a refund is required by the Consumer Protection Act or other applicable law, or by the platform’s published refund policy.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">7. Sales commission (4% · 5% · 6% — super-link at 6%)</h3>
  <p>7.1 Commission is calculated on qualifying closed / paid deal value (ZAR) using a
  <strong>stepped scale</strong>: the whole deal earns one rate based on size.
  Rates work <strong>backwards from a super-link load</strong> (see clause 8):
  a full super-link is <strong>${MAX_COMMISSION_PCT}%</strong>; smaller deals earn
  <strong>5%</strong> then <strong>${MIN_COMMISSION_PCT}%</strong>.</p>
  <div class="overflow-x-auto my-3 rounded-xl border border-slate-200">
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <th class="px-3 py-2">Deal size (ZAR, illustrative bands)</th>
          <th class="px-3 py-2">Rate on whole deal</th>
          <th class="px-3 py-2">Tier</th>
        </tr>
      </thead>
      <tbody>${tierRows}</tbody>
    </table>
  </div>
  <p>7.2 Projected earnings in the portal are estimates;
  <strong>earned commission</strong> accrues when an invoice is marked paid (or as otherwise configured by the Company). Payouts are subject to Company approval, clawback for cancellations, credit notes or refunds, and applicable tax law (including any obligation to issue a valid tax invoice if the Contractor is a VAT vendor).</p>
  <p class="text-xs text-neutral-500">Scale summary: ${escape(tiersSummaryText(tiers))}</p>
  <p class="text-xs text-neutral-500">Band thresholds use an illustrative super-link value of ${formatZar(halfSuperLinkDealValue())} (½ link) and ${formatZar(linkDeal)} (1 full link at ${SUPER_LINK_TONNES} t × ${formatZar(SUPER_LINK_EXAMPLE_ZAR_PER_TONNE)}/t). Live product prices may differ; the Company may publish updated band values, but the rate structure remains 4% / 5% / 6% with a full link at 6%.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">8. Worked example — super-link load (32 tonnes) at 6%</h3>
  <p>8.1 For illustration only (not a price list or guarantee of any specific sale), a <strong>super-link</strong> road combination is treated as a payload unit of
  <strong>${SUPER_LINK_TONNES} tonnes</strong> (“one link”).</p>
  <p>8.2 At an illustrative selling price of <strong>${formatZar(SUPER_LINK_EXAMPLE_ZAR_PER_TONNE)} per tonne</strong>, one super-link load has a deal value of:</p>
  <p class="font-semibold text-slate-900 pl-3 border-l-4 border-[#00b4d8] my-2">
    ${SUPER_LINK_TONNES} t × ${formatZar(SUPER_LINK_EXAMPLE_ZAR_PER_TONNE)}/t =
    <strong>${formatZar(linkDeal)}</strong>
  </p>
  <p>8.3 That deal sits in the top tier, so commission is
  <strong>${MAX_COMMISSION_PCT}%</strong> on the whole amount =
  <strong>${formatZarPrecise(linkComm.commissionAmount)}</strong>
  (${MAX_COMMISSION_PCT}% × ${formatZar(linkDeal)}).</p>
  <p>8.4 Working backwards: deals under half a super-link earn <strong>4%</strong> on the whole deal; deals from half a super-link up to (but not including) a full super-link earn <strong>5%</strong> on the whole deal; a full super-link (32 t) and larger deals earn <strong>6%</strong>.</p>
  <p>8.5 Actual prices, products, load sizes and deal values are set by the Company for each campaign and customer. Commission always follows the live tier table and paid invoice value recorded in SupplierAdvisor.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">9. Conduct, confidentiality &amp; competition</h3>
  <p>9.1 The Contractor must not misrepresent pricing, product claims, delivery, financing or the Company’s legal standing. Discrimination, bribery, kickbacks and other unlawful practices are prohibited.</p>
  <p>9.2 The Contractor must keep confidential all non-public Company information (pricing, customer lists, margins, strategies) and must not use it for competing sales after termination, without prejudice to restraints that are reasonable and enforceable under South African common law.</p>
  <p>9.3 The Contractor must comply with applicable health and safety laws when attending sites, and with Company brand guidelines when using logos or trade marks.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">10. Term, suspension &amp; termination</h3>
  <p>10.1 This Agreement starts on electronic acceptance and continues until terminated by either Party on reasonable written notice (email suffices), or immediately for material breach, fraud, POPIA breach, or unlawful conduct.</p>
  <p>10.2 On termination the Contractor must: cease holding themselves out as selling for the Company; stop using the @${SALES_CONTRACTOR_EMAIL_DOMAIN} address and any Company materials; and return credentials, devices and documents on request.</p>
  <p>10.3 Clauses that by nature survive termination (ownership of data, confidentiality, POPIA, commission clawback for pre-termination deals, liability, governing law) remain in force.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">11. Liability &amp; indemnity</h3>
  <p>11.1 To the fullest extent permitted by law, the Company is not liable for indirect or consequential loss (including loss of profit or opportunity) arising from portal unavailability or third-party payment providers, except for gross negligence or wilful misconduct.</p>
  <p>11.2 The Contractor indemnifies the Company against claims arising from the Contractor’s fraud, unlawful statements to customers, or processing of personal information outside the Company’s instructions, except to the extent caused by the Company.</p>
  <p>11.3 Nothing excludes liability for death or personal injury caused by negligence where such exclusion is unlawful, or for any other liability that cannot be limited under South African law.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">12. Electronic acceptance (ECTA)</h3>
  <p>12.1 By selecting “I have read and agree”, typing their full legal name, and continuing with secure authentication, the Contractor:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>confirms they have read and understood this Agreement (version <strong>${SALES_CONTRACTOR_CONTRACT_VERSION}</strong>);</li>
    <li>accepts appointment as an independent sales contractor to the Company’s customer sales team;</li>
    <li>understands the commission scale (${MIN_COMMISSION_PCT}% → ${MAX_COMMISSION_PCT}%), the super-link example in clause 8, and the portal subscription in clause 6;</li>
    <li>consents to allocation of a <strong>@${SALES_CONTRACTOR_EMAIL_DOMAIN}</strong> email address under clause 4;</li>
    <li>agrees that this electronic signature is intended to have the same legal effect as a handwritten signature under ECTA.</li>
  </ul>
  <p>12.2 The Company may retain audit logs (timestamp, user identity, IP/user agent where available) as evidence of acceptance.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">13. General</h3>
  <p>13.1 This Agreement is the entire agreement on its subject matter and supersedes prior inconsistent discussions, except for any separate written commission side-letter signed by the Company.</p>
  <p>13.2 If any provision is unenforceable, it is severed to the minimum extent necessary; the rest remains in force.</p>
  <p>13.3 No waiver is effective unless in writing. The Contractor may not cede or assign rights without the Company’s prior written consent; the Company may cede to an affiliate on written notice.</p>
  <p>13.4 Notices may be given by email to the addresses on record (including the allocated @${SALES_CONTRACTOR_EMAIL_DOMAIN} mailbox once issued).</p>
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
          <li style="margin-bottom:6px;">Commission <strong>4% · 5% · 6%</strong> — super-link (32 t) at <strong>6%</strong></li>
          <li style="margin-bottom:6px;">Example: super-link = <strong>${SUPER_LINK_TONNES} t</strong> → ${formatZar(linkDeal)} → commission ${formatZarPrecise(linkComm.commissionAmount)} at 6%</li>
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
