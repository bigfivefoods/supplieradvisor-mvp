/**
 * Run: npx --yes tsx lib/sales-contractor/company-records.test.ts
 */
import assert from 'node:assert/strict';
import {
  agreementPartyLabel,
  agreementProofLabel,
  pickStoredAgreement,
  proofFromMember,
  proofsForContractors,
  type AgreementStoreRow,
} from './company-records';

const pam: AgreementStoreRow = {
  id: 13,
  profile_id: 102,
  business_user_id: 82,
  user_id: 'did:privy:cmv6j1wgl002w0fldpnyurffw',
  contractor_name: 'Pam Oosthuizen',
  status: 'signed',
  contract_version: 'ISC-2026.10-ZA',
  signed_at: '2026-08-01T10:00:00.000Z',
  signature_name: 'Pam Oosthuizen',
  signature_email: 'pamoosthuizen@outlook.com',
  accepted_ip: '102.0.0.8',
  subscription_status: 'active',
  subscription_ends_at: '9999-12-31T00:00:00.000Z',
  metadata: { complimentary_lifetime: true },
};

const newerDraft: AgreementStoreRow = {
  id: 40,
  profile_id: 102,
  business_user_id: 82,
  user_id: 'did:privy:cmv6j1wgl002w0fldpnyurffw',
  status: 'pending',
  contract_version: 'ISC-2026.10-ZA',
};

const otherCompany: AgreementStoreRow = {
  ...pam,
  id: 99,
  profile_id: 7,
  business_user_id: 82,
};

const picked = pickStoredAgreement(
  { id: 82, user_id: 'cmv6j1wgl002w0fldpnyurffw' },
  [newerDraft, otherCompany, pam],
  102
);
assert.equal(picked?.id, 13);

const byUser = pickStoredAgreement(
  { id: 500, user_id: 'did:privy:cmv6j1wgl002w0fldpnyurffw' },
  [{ ...pam, business_user_id: null }],
  102
);
assert.equal(byUser?.id, 13);

const missing = proofFromMember(82, null);
assert.equal(missing.onFile, false);
assert.equal(missing.agreementId, null);
assert.equal(agreementProofLabel(missing), 'No agreement on file');

const proof = proofFromMember(82, pam);
assert.equal(proof.agreementId, 13);
assert.equal(proof.status, 'signed');
assert.equal(proof.lifetime, true);
assert.equal(proof.signatureEmail, 'pamoosthuizen@outlook.com');
assert.equal(proof.contractorCompanyName, null);
assert.equal(proof.contractResendCount, 0);
assert.equal(agreementProofLabel(proof), 'Signed');
assert.equal(agreementPartyLabel(proof), 'Pam Oosthuizen');

const companyProof = proofFromMember(82, {
  ...pam,
  status: 'pending',
  signed_at: null,
  metadata: {
    contractor_company_name: 'X (Pty) Ltd',
    contractor_registration_number: '2020/123456/07',
    contract_resent_at: '2026-10-28T08:00:00.000Z',
    contract_resend_count: 2,
  },
});
assert.equal(companyProof.contractorCompanyName, 'X (Pty) Ltd');
assert.equal(companyProof.contractorRegistrationNumber, '2020/123456/07');
assert.equal(companyProof.contractResentAt, '2026-10-28T08:00:00.000Z');
assert.equal(companyProof.contractResendCount, 2);
assert.equal(
  agreementPartyLabel(companyProof),
  'X (Pty) Ltd (registration number 2020/123456/07), represented by Pam Oosthuizen'
);

const list = proofsForContractors(
  [
    { id: 82, user_id: pam.user_id },
    { id: 3, user_id: 'did:privy:nobody' },
  ],
  [pam],
  102
);
assert.equal(list[0]?.onFile, true);
assert.equal(list[1]?.onFile, false);

console.log('company-records.test.ts ok');
