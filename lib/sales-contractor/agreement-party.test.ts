/**
 * Run: npx --yes tsx lib/sales-contractor/agreement-party.test.ts
 * Pure checks. The email case uses a mock transport and does not call Resend.
 */
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import {
  buildSalesAgreementDownloadDocument,
  getSalesContractorAgreementHtml,
  salesContractorAgreementEmail,
} from './agreement';
import { buildSalesAgreementPdf } from './agreement-pdf';
import {
  agreementFilenameParty,
  agreementResendDecision,
  commissionActivityLabel,
  contractorContractingParty,
  contractorExecutionLine,
  isMissingSalesAgreementColumn,
  omitSalesAgreementOptionalColumns,
  salesAgreementResendHref,
  withResendMetadata,
} from './party';
import { deliverSalesContractorAgreementEmail } from './send-agreement';

const hiring = 'Acme Foods (Pty) Ltd';
const person = 'Jane Doe';

const plain = getSalesContractorAgreementHtml({
  contractorName: person,
  companyName: hiring,
});
const blankCompany = getSalesContractorAgreementHtml({
  contractorName: person,
  companyName: hiring,
  contractorCompanyName: '   ',
  contractorRegistrationNumber: '2020/123456/07',
});
assert.equal(blankCompany, plain);
assert.equal(plain.includes('represented by'), false);
assert.equal(plain.includes(person), true);

const named = getSalesContractorAgreementHtml({
  contractorName: person,
  companyName: hiring,
  contractorCompanyName: 'X (Pty) Ltd',
});
assert.match(named, /Between <strong>Acme Foods \(Pty\) Ltd<\/strong> and <strong>X \(Pty\) Ltd<\/strong>/);
assert.match(named, /<strong>“Contractor”<\/strong> means <strong>X \(Pty\) Ltd<\/strong>/);
assert.match(named, /The individual who signs is not the Contractor/);
assert.equal(named.includes('represented by'), false);
assert.match(
  named,
  /For and on behalf of X \(Pty\) Ltd, signed by Jane Doe, who warrants they are duly authorised/
);
assert.equal(plain.includes('For and on behalf of'), false);
assert.equal(plain.includes('“Contractor” means'), false);

const registered = getSalesContractorAgreementHtml({
  contractorName: person,
  companyName: hiring,
  contractorCompanyName: 'X (Pty) Ltd',
  contractorRegistrationNumber: '2020/123456/07',
  signerCapacity: 'Director',
});
assert.match(
  registered,
  /For and on behalf of X \(Pty\) Ltd, reg no 2020\/123456\/07, signed by Jane Doe, Director, who warrants they are duly authorised/
);
assert.equal(
  contractorExecutionLine({
    personName: person,
    companyName: 'X (Pty) Ltd',
    registrationNumber: '2020/123456/07',
    capacity: 'Director',
  }),
  'For and on behalf of X (Pty) Ltd, reg no 2020/123456/07, signed by Jane Doe, Director, who warrants they are duly authorised'
);
assert.equal(contractorExecutionLine({ personName: person, companyName: '  ' }), '');
assert.equal(contractorContractingParty({ personName: person, companyName: 'X (Pty) Ltd' }), 'X (Pty) Ltd');

const hostile = getSalesContractorAgreementHtml({
  contractorName: person,
  companyName: hiring,
  contractorCompanyName: '<script>alert(1)</script>',
});
assert.equal(hostile.includes('<script>'), false);
assert.match(hostile, /&lt;script&gt;/);

assert.equal(
  contractorContractingParty({ personName: '  Pam Oosthuizen  ', companyName: '' }),
  '  Pam Oosthuizen  '
);

const meta = {
  companyName: hiring,
  contractorName: person,
  status: 'pending' as const,
  generatedAt: '1 January 2026 at 10:00',
};
const draft = buildSalesAgreementDownloadDocument({
  bodyHtml: '<p>Body</p>',
  meta,
});
const draftBlank = buildSalesAgreementDownloadDocument({
  bodyHtml: '<p>Body</p>',
  meta: { ...meta, contractorCompanyName: '', contractorRegistrationNumber: null },
});
assert.equal(draftBlank, draft);
assert.match(draft, /Proposed contractor<\/th><td>Jane Doe/);
assert.equal(draft.includes('represented by'), false);

const signedDoc = buildSalesAgreementDownloadDocument({
  bodyHtml: '<p>Body</p>',
  meta: {
    ...meta,
    status: 'signed',
    signatureName: person,
    signedAt: '2026-01-01T00:00:00.000Z',
    contractorCompanyName: 'X (Pty) Ltd',
  },
});
assert.match(
  signedDoc,
  /Signatory name<\/th><td>For and on behalf of X \(Pty\) Ltd, signed by Jane Doe, who warrants they are duly authorised/
);

const blocked = agreementResendDecision({ email: 'jane@example.com', status: 'signed' });
assert.equal(blocked.ok, false);
if (!blocked.ok) assert.equal(blocked.status, 409);

const missingEmail = agreementResendDecision({ email: 'not-an-email', status: 'pending' });
assert.equal(missingEmail.ok, false);

const allowed = agreementResendDecision({
  email: ' Sales.Contractor@example.com ',
  status: 'pending',
});
assert.equal(allowed.ok, true);
if (allowed.ok) assert.equal(allowed.email, 'sales.contractor@example.com');

assert.equal(
  salesAgreementResendHref({
    appUrl: 'https://www.supplieradvisor.com',
    memberStatus: 'active',
    joinLink: 'https://www.supplieradvisor.com/onboarding/team?invite=secret',
  }),
  'https://www.supplieradvisor.com/sales/agreement'
);
assert.equal(
  salesAgreementResendHref({
    appUrl: 'https://www.supplieradvisor.com',
    memberStatus: 'invited',
    joinLink: 'https://www.supplieradvisor.com/onboarding/team?invite=secret',
  }),
  'https://www.supplieradvisor.com/onboarding/team?invite=secret'
);

const stamped = withResendMetadata(
  { program_snapshot: { contract_version: 'ISC-2026.10-ZA' }, contract_resend_count: 1 },
  '2026-10-28T08:00:00.000Z'
);
assert.equal(stamped.contract_resent_at, '2026-10-28T08:00:00.000Z');
assert.equal(stamped.contract_resend_count, 2);
assert.equal(
  (stamped.program_snapshot as { contract_version: string }).contract_version,
  'ISC-2026.10-ZA'
);

assert.equal(
  isMissingSalesAgreementColumn(
    "Could not find the 'contractor_company_name' column of 'sales_contractor_agreements' in the schema cache"
  ),
  true
);
const stripped = omitSalesAgreementOptionalColumns({
  status: 'pending',
  contractor_company_name: 'X (Pty) Ltd',
  contract_resent_at: '2026-10-28T08:00:00.000Z',
});
assert.equal('contractor_company_name' in stripped, false);
assert.equal(stripped.status, 'pending');

const mail = salesContractorAgreementEmail({
  personName: person,
  hiringCompanyName: hiring,
  contractorCompanyName: 'X (Pty) Ltd',
  contractorRegistrationNumber: '2020/123456/07',
  agreementLink: 'https://www.supplieradvisor.com/sales/agreement',
  invitedBy: 'Craig',
});
assert.match(mail.subject, /^Sales contractor agreement with X \(Pty\) Ltd$/);
assert.match(mail.html, /Hello X \(Pty\) Ltd,/);
assert.match(mail.html, /SupplierAdvisor®/);
assert.match(mail.html, /#00b4d8/);
assert.match(
  mail.text,
  /For and on behalf of X \(Pty\) Ltd, reg no 2020\/123456\/07, signed by Jane Doe, who warrants they are duly authorised/
);
assert.match(mail.html, /Open the agreement/);
assert.equal(agreementFilenameParty('X (Pty) Ltd', person), 'X (Pty) Ltd');
assert.equal(agreementFilenameParty('  ', person), person);
assert.equal(
  commissionActivityLabel({ status: 'earned', customerName: 'North Store', sourceType: 'invoice' }),
  'earned commission · North Store'
);
assert.equal(
  commissionActivityLabel({
    status: 'earned',
    customerName: 'North Store',
    companyName: 'X (Pty) Ltd',
  }),
  'Payable to X (Pty) Ltd · earned commission · North Store'
);

const plainMail = salesContractorAgreementEmail({
  personName: person,
  hiringCompanyName: hiring,
  agreementLink: 'https://www.supplieradvisor.com/sales/agreement',
});
assert.equal(plainMail.text.includes('represented by'), false);
assert.equal(plainMail.html.includes('represented by'), false);
assert.match(plainMail.subject, /Acme Foods/);

const hostileMail = salesContractorAgreementEmail({
  personName: person,
  hiringCompanyName: hiring,
  contractorCompanyName: '<script>',
  agreementLink: 'https://www.supplieradvisor.com/sales/agreement',
});
assert.equal(hostileMail.html.includes('<script>'), false);

async function main() {
  let sentTo = '';
  const delivered = await deliverSalesContractorAgreementEmail({
    to: 'sales.contractor@example.com',
    personName: person,
    hiringCompanyName: hiring,
    contractorCompanyName: 'X (Pty) Ltd',
    memberStatus: 'active',
    transport: async (payload) => {
      sentTo = payload.to;
      assert.match(payload.html, /Hello X \(Pty\) Ltd,/);
      assert.match(payload.text, /For and on behalf of X \(Pty\) Ltd, signed by Jane Doe/);
      assert.match(payload.html, /SupplierAdvisor®/);
      assert.match(payload.text, /\/sales\/agreement/);
      return { id: 'test-email-1' };
    },
  });
  assert.equal(sentTo, 'sales.contractor@example.com');
  assert.equal(delivered.ok, true);

  const previousDisable = process.env.AGREEMENT_EMAIL_DISABLE;
  process.env.AGREEMENT_EMAIL_DISABLE = '1';
  const blockedSend = await deliverSalesContractorAgreementEmail({
    to: 'sales.contractor@example.com',
    personName: person,
    hiringCompanyName: hiring,
    memberStatus: 'active',
  });
  if (previousDisable === undefined) delete process.env.AGREEMENT_EMAIL_DISABLE;
  else process.env.AGREEMENT_EMAIL_DISABLE = previousDisable;
  assert.equal(blockedSend.ok, false);
  if (!blockedSend.ok) assert.equal(blockedSend.status, 503);

  const pdfNamed = await buildSalesAgreementPdf({
    bodyHtml: named,
    meta: {
      ...meta,
      contractorCompanyName: 'X (Pty) Ltd',
      status: 'pending',
    },
  });
  assert.match(
    pdfPlainText(pdfNamed),
    /For and on behalf of X \(Pty\) Ltd, signed by Jane Doe, who warrants they are duly authorised/
  );

  const pdfPlain = await buildSalesAgreementPdf({
    bodyHtml: plain,
    meta,
  });
  assert.equal(pdfPlainText(pdfPlain).includes('For and on behalf of'), false);

  console.log('agreement-party.test.ts ok');
}

function pdfPlainText(buf: Buffer): string {
  const out: string[] = [];
  const markers = [Buffer.from('stream\n'), Buffer.from('stream\r\n')];
  const end = Buffer.from('endstream');
  let i = 0;
  while (i < buf.length) {
    let start = -1;
    let markerLen = 0;
    for (const marker of markers) {
      const at = buf.indexOf(marker, i);
      if (at >= 0 && (start < 0 || at < start)) {
        start = at;
        markerLen = marker.length;
      }
    }
    if (start < 0) break;
    const dataStart = start + markerLen;
    const stop = buf.indexOf(end, dataStart);
    if (stop < 0) break;
    const slice = buf.subarray(dataStart, stop);
    try {
      out.push(inflateSync(slice).toString('utf8'));
    } catch {
      out.push(slice.toString('latin1'));
    }
    i = stop + end.length;
  }
  return out
    .join('\n')
    .replace(/<([0-9A-Fa-f\s]+)>/g, (_, hex: string) => {
      const clean = hex.replace(/\s+/g, '');
      let text = '';
      for (let n = 0; n + 1 < clean.length; n += 2) {
        const code = Number.parseInt(clean.slice(n, n + 2), 16);
        if (Number.isFinite(code)) text += String.fromCharCode(code);
      }
      return text;
    })
    .replace(/\s-?\d+(?:\.\d+)?\s/g, '');
}

void main();
