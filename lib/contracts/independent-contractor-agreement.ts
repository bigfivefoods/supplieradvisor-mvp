/** Versioned Independent Contractor Agreement for container operators */
export const CONTRACTOR_CONTRACT_VERSION = 'IC-2026.1';

export const CONTRACTOR_CONTRACT_TITLE =
  'Independent Contractor Agreement — Container Retail Operator';

export function getContractorContractHtml(params: {
  contractorName: string;
  companyName: string;
  containerName: string;
  containerCode?: string;
}): string {
  const { contractorName, companyName, containerName, containerCode } = params;
  const date = new Date().toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<div class="space-y-4 text-sm leading-relaxed text-slate-700">
  <p class="text-xs text-neutral-500">Version ${CONTRACTOR_CONTRACT_VERSION} · Effective ${date}</p>
  <p><strong>Between:</strong> <em>${companyName}</em> (“Company”) and <em>${contractorName || 'the Contractor'}</em> (“Contractor”).</p>
  <p><strong>Outlet:</strong> ${containerName}${containerCode ? ` (${containerCode})` : ''} (“Container”).</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">1. Nature of relationship</h3>
  <p>The Contractor is engaged as an <strong>independent contractor</strong>, not as an employee, partner, or agent of the Company. Nothing in this Agreement creates employment, joint venture, or agency. The Contractor is responsible for their own tax, UIF, and statutory compliance where applicable.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">2. Appointment &amp; scope</h3>
  <p>The Company appoints the Contractor to operate the Container as a retail outlet, including:</p>
  <ul class="list-disc pl-5 space-y-1">
    <li>Receiving and storing inventory assigned to the Container</li>
    <li>Selling products to customers in a professional and lawful manner</li>
    <li>Performing stock counts and reporting discrepancies promptly</li>
    <li>Placing replenishment orders through the SupplierAdvisor contractor portal</li>
    <li>Maintaining cleanliness, safety, and brand standards at the outlet</li>
  </ul>

  <h3 class="font-bold text-slate-900 text-base pt-2">3. Access &amp; data</h3>
  <p>Upon acceptance, the Contractor receives a secure portal login limited to Container(s) allocated to them. The Contractor must not share credentials, must protect customer and sales data, and may only use the portal for authorised operations.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">4. Inventory &amp; cash</h3>
  <p>Inventory remains the property of the Company unless otherwise agreed in writing. The Contractor must account for stock, sales, and cash according to Company procedures. Loss due to negligence or fraud may be recovered subject to applicable law.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">5. Fees &amp; payouts</h3>
  <p>Compensation (commission, retainer, or hybrid) is as agreed separately with the Company. Payouts may be processed against verified sales and stock performance recorded in SupplierAdvisor.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">6. Compliance &amp; conduct</h3>
  <p>The Contractor must comply with all applicable laws, health and safety rules, and Company policies. Discrimination, unsafe practices, or misrepresentation of products is prohibited.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">7. Term &amp; termination</h3>
  <p>Either party may terminate this engagement on reasonable written notice (or immediately for material breach). On termination the Contractor must return keys, devices, stock, and access credentials and complete a final stock count.</p>

  <h3 class="font-bold text-slate-900 text-base pt-2">8. Acceptance</h3>
  <p>By selecting “I have read and agree” and continuing with secure authentication, the Contractor confirms they have read this Agreement, understand it, and accept appointment for the Container named above under version <strong>${CONTRACTOR_CONTRACT_VERSION}</strong>.</p>
</div>
`.trim();
}

export function contractorInviteEmailHtml(params: {
  contractorName?: string | null;
  companyName: string;
  containerName: string;
  inviteLink: string;
}): string {
  const { contractorName, companyName, containerName, inviteLink } = params;
  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#00b4d8,#0077b6);padding:36px 40px;color:#fff;text-align:center;">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">SupplierAdvisor®</div>
      <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;">Operator invitation</h1>
    </div>
    <div style="padding:36px 40px;color:#334155;font-size:16px;line-height:1.7;">
      <p style="margin:0 0 16px;">Hello${contractorName ? ` ${contractorName}` : ''},</p>
      <p style="margin:0 0 16px;"><strong>${companyName}</strong> has invited you to operate retail outlet <strong>${containerName}</strong> as an independent contractor.</p>
      <p style="margin:0 0 16px;">What happens next:</p>
      <ol style="margin:0 0 24px;padding-left:20px;color:#475569;">
        <li style="margin-bottom:8px;">Open the secure link and read the Independent Contractor Agreement</li>
        <li style="margin-bottom:8px;">Sign in with <em>this email address</em> (one-time code, Google, or Apple)</li>
        <li style="margin-bottom:8px;">Accept the contract — then manage <em>only your allocated outlet</em></li>
      </ol>
      <p style="margin:0 0 8px;font-size:14px;color:#64748b;">In your portal you can: view inventory, receive stock, place replenishment orders, record sales, and submit stock counts. Company admin dashboards are not available on this login.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${inviteLink}" style="background:#00b4d8;color:#fff;padding:16px 40px;border-radius:9999px;text-decoration:none;font-weight:700;display:inline-block;">
          Review contract &amp; accept →
        </a>
      </div>
      <p style="font-size:13px;color:#64748b;margin:0;">This link expires in 14 days. If the button fails, paste:<br/>
        <a href="${inviteLink}" style="color:#00b4d8;word-break:break-all;">${inviteLink}</a>
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
      SupplierAdvisor® · Independent contractor operator portal · Version ${CONTRACTOR_CONTRACT_VERSION}
    </div>
  </div>
</body></html>`;
}
