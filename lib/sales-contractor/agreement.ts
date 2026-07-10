import {
  DEFAULT_COMMISSION_TIERS,
  MAX_COMMISSION_PCT,
  MIN_COMMISSION_PCT,
  tiersSummaryText,
  type CommissionTier,
} from './commission';
import {
  SALES_SUBSCRIPTION_MONTHLY_ZAR,
  SALES_SUBSCRIPTION_TERM_MONTHS,
  SALES_SUBSCRIPTION_TOTAL_ZAR,
} from './subscription';

export const SALES_CONTRACTOR_CONTRACT_VERSION = 'ISC-2026.3';

export const SALES_CONTRACTOR_CONTRACT_TITLE =
  'Independent Sales Contractor Agreement';

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
      const from = i === 0 ? 'R0' : `R${Number(tiers[i - 1].upTo || 0).toLocaleString('en-ZA')}`;
      const to =
        t.upTo == null ? 'and above' : `R${Number(t.upTo).toLocaleString('en-ZA')}`;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${from} – ${to}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0077b6;">${t.ratePct}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;">${t.label || ''}</td>
      </tr>`;
    })
    .join('');

  return `
<div class="space-y-4 text-sm leading-relaxed text-slate-700">
  <p class="text-xs text-neutral-500">Version ${SALES_CONTRACTOR_CONTRACT_VERSION} · Effective ${date}</p>
  <p><strong>Between:</strong> <em>${escape(companyName)}</em> (“Company”) and
  <em>${escape(contractorName || 'the Sales Contractor')}</em> (“Contractor”).</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">1. Nature of relationship</h3>
  <p>The Contractor is engaged as an <strong>independent sales contractor</strong>, not as an employee,
  partner, or agent with authority to bind the Company beyond authorised quotations and platform workflows.
  Nothing in this Agreement creates employment, joint venture, or permanent agency. The Contractor is
  responsible for their own tax, UIF (if applicable), and statutory compliance.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">2. Appointment &amp; scope</h3>
  <p>The Company appoints the Contractor to sell on behalf of the Company using the SupplierAdvisor
  Sales Contractor Portal, including:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>Capturing and nurturing leads and opportunities for the Company’s products and services</li>
    <li>Onboarding customers into the Company’s CRM (all records belong to the Company)</li>
    <li>Preparing quotations, progressing orders, and supporting invoice collection workflows</li>
    <li>Representing the Company professionally and accurately in the market</li>
  </ul>

  <h3 class="font-bold text-slate-900 text-base pt-2">3. Company ownership of data</h3>
  <p>All leads, customers, quotes, orders, invoices, documents, and related CRM data created or managed
  by the Contractor are the <strong>exclusive property of the Company</strong>. The Contractor receives
  limited portal access solely to perform sales duties. Credentials must not be shared. On termination,
  access ends immediately and the Contractor retains no ownership of customer relationships introduced
  through this engagement unless otherwise agreed in writing.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">4. Platform subscription (SupplierAdvisor)</h3>
  <p>Access to the Sales Contractor Portal requires an active platform subscription of
  <strong>R${SALES_SUBSCRIPTION_MONTHLY_ZAR} per month</strong>, billed as a
  <strong>${SALES_SUBSCRIPTION_TERM_MONTHS}-month</strong> term
  (total <strong>R${SALES_SUBSCRIPTION_TOTAL_ZAR.toLocaleString('en-ZA')}</strong> prepaid via Paystack).
  Portal features (pipeline tools, commission tracking, forecasts) are available only while the
  subscription is active. The subscription is payable by the Contractor to SupplierAdvisor and is
  separate from commission paid by the Company on closed deals.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">5. Sales commission (sliding scale — grows with deal size)</h3>
  <p>Commission is calculated on qualifying closed / paid deal value using a progressive sliding scale.
  <strong>Larger deals earn higher commission rates</strong>, from a minimum of
  <strong>${MIN_COMMISSION_PCT}%</strong> up to a maximum of
  <strong>${MAX_COMMISSION_PCT}%</strong>:</p>
  <div class="overflow-x-auto my-3 rounded-xl border border-slate-200">
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <th class="px-3 py-2">Deal band (ZAR)</th>
          <th class="px-3 py-2">Rate</th>
          <th class="px-3 py-2">Tier</th>
        </tr>
      </thead>
      <tbody>${tierRows}</tbody>
    </table>
  </div>
  <p>Commission is progressive across bands (higher rates apply to the portion of the deal that falls
  in each higher band). Projected earnings in the portal are estimates;
  <strong>earned commission</strong> accrues when an invoice is marked paid (or as otherwise configured
  by the Company). Payouts are subject to Company approval, clawback for cancellations/refunds, and
  applicable law.</p>
  <p class="text-xs text-neutral-500">Scale summary: ${escape(tiersSummaryText(tiers))}</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">6. Conduct &amp; brand</h3>
  <p>The Contractor must not misrepresent pricing, product claims, delivery, or the Company’s legal
  standing. Discrimination, bribery, and unlawful practices are prohibited. The Contractor may not
  use Company confidential information for competing sales after termination.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">7. Term &amp; termination</h3>
  <p>Either party may terminate on reasonable written notice, or immediately for material breach.
  On termination the Contractor must cease holding themselves out as selling for the Company and
  return any materials or credentials. Platform subscription fees already paid are non-refundable
  except where required by law.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">8. Electronic acceptance</h3>
  <p>By selecting “I have read and agree”, typing their full name, and continuing with secure
  authentication, the Contractor confirms they have read this Agreement (version
  <strong>${SALES_CONTRACTOR_CONTRACT_VERSION}</strong>), understand the commission scale (up to ${MAX_COMMISSION_PCT}%),
  the R${SALES_SUBSCRIPTION_MONTHLY_ZAR}/month ${SALES_SUBSCRIPTION_TERM_MONTHS}-month portal subscription,
  and accept appointment to the Company’s customer sales team.</p>
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
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#f59e0b 0%,#ea580c 45%,#00b4d8 100%);padding:40px 36px;color:#fff;">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.95;">SupplierAdvisor® · Customer sales team</div>
      <h1 style="margin:12px 0 0;font-size:28px;font-weight:900;letter-spacing:-0.6px;line-height:1.15;">
        You're invited to sell with ${escape(companyName)}
      </h1>
      <p style="margin:14px 0 0;font-size:15px;opacity:.95;line-height:1.6;max-width:480px;">
        Join as an <strong>Independent Sales Contractor</strong> — earn progressive commission from
        <strong>3% up to 5%</strong> as deals get bigger, with a world-class portal for leads, customers, quotes, and earnings.
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
          <li style="margin-bottom:6px;">Signed Independent Sales Contractor Agreement</li>
          <li style="margin-bottom:6px;">Platform access: <strong>R${SALES_SUBSCRIPTION_MONTHLY_ZAR}/month</strong> · ${SALES_SUBSCRIPTION_TERM_MONTHS}-month subscription (R${SALES_SUBSCRIPTION_TOTAL_ZAR} prepaid)</li>
          <li style="margin-bottom:6px;">Commission grows with deal size — up to <strong>5%</strong></li>
          <li style="margin-bottom:6px;">Pipeline, forecast charts &amp; earnings ledger</li>
          <li>All customer data saved under ${escape(companyName)}</li>
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
      SupplierAdvisor® · Independent sellers. Company-owned CRM. Commission 3%–5% (grows with deal size).
    </div>
  </div>
</body>
</html>`;
}
