/**
 * Company payout wallet controls.
 * Run: npx --yes tsx lib/business/company-wallet.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { canWrite } from './permissions';
import { supplierPatchUpdates } from '../suppliers/book-persist';
import {
  COMPANY_WALLET_MIGRATION,
  anchorCompanyWallet,
  assertWalletChallengeUsable,
  buildWalletControlMessage,
  canChangeCompanyWallet,
  commitCompanyWalletChange,
  disclosePayeeWallet,
  externalWalletLabel,
  hidePoPayee,
  maskWalletAddress,
  presentCompanyWallet,
  profileWalletPatchDecision,
  redactExternalWallet,
  verifyWalletControlSignature,
  walletChangeEmail,
  type WalletAuditRow,
  type WalletChallenge,
} from './company-wallet';

const FULL = '0x1234567890abcdef1234567890abcdef1234abcd';

assert.equal(canWrite('member', 'profile'), true);
assert.equal(canWrite('admin', 'profile'), true);
assert.equal(canChangeCompanyWallet('member'), false);
assert.equal(canChangeCompanyWallet('admin'), false);
assert.equal(canChangeCompanyWallet('finance'), false);
assert.equal(canChangeCompanyWallet('owner'), true);
assert.equal(canChangeCompanyWallet('CEO'), true);

assert.equal(maskWalletAddress(FULL), '0x1234…abcd');
assert.equal(maskWalletAddress('0x1234…abcd'), '0x1234…abcd');
assert.equal(maskWalletAddress(''), null);

const external = presentCompanyWallet(FULL, 'external');
assert.equal(external.wallet_ready, true);
assert.equal('wallet_address' in external, false);
const memberView = presentCompanyWallet(FULL, 'member');
assert.equal(memberView.wallet_address, '0x1234…abcd');
assert.equal(presentCompanyWallet(FULL, 'owner').wallet_address, FULL);
assert.equal(presentCompanyWallet(FULL, 'paying_buyer').wallet_address, FULL);
assert.equal(presentCompanyWallet(null, 'external').wallet_ready, false);

const redacted = redactExternalWallet({ id: 7, wallet_address: FULL, trading_name: 'Kelpack' });
assert.equal(redacted.wallet_ready, true);
assert.equal('wallet_address' in redacted, false);
assert.equal(redacted.trading_name, 'Kelpack');

const hidden = hidePoPayee({ id: 3, supplier_wallet: FULL });
assert.equal(hidden.supplier_wallet_ready, true);
assert.equal('supplier_wallet' in hidden, false);

assert.equal(externalWalletLabel({ wallet_address: FULL }), 'Ready');
assert.equal(externalWalletLabel({ wallet_address: FULL }).includes('0x'), false);
assert.equal(externalWalletLabel({ wallet_ready: false, wallet_address: FULL }), 'Not set');
assert.equal(externalWalletLabel({ wallet_ready: false, wallet_address: FULL }).includes('0x'), false);
assert.equal(externalWalletLabel({ wallet_ready: true }), 'Ready');
assert.equal(externalWalletLabel({}), 'Not set');

assert.equal(profileWalletPatchDecision({ incoming: undefined, current: FULL }), 'absent');
assert.equal(
  profileWalletPatchDecision({ incoming: FULL.toUpperCase(), current: FULL }),
  'ignore'
);
assert.equal(
  profileWalletPatchDecision({ incoming: '0x' + 'ab'.repeat(20), current: FULL }),
  'reject'
);

assert.equal(anchorCompanyWallet({ role: 'viewer', stored: FULL }).ok, false);
assert.equal(anchorCompanyWallet({ role: 'member', stored: null }).ok, false);
const anchored = anchorCompanyWallet({ role: 'operations', stored: FULL });
assert.equal(anchored.ok, true);
if (anchored.ok) assert.equal(anchored.companyWallet, FULL);
assert.equal(anchorCompanyWallet({ role: 'member', stored: '0xnot-the-body' }).ok, false);

assert.deepEqual(
  disclosePayeeWallet({
    callerIsPayingBuyer: false,
    atOnchainPayment: true,
    stored: FULL,
  }),
  { wallet_ready: true }
);
assert.deepEqual(
  disclosePayeeWallet({
    callerIsPayingBuyer: true,
    atOnchainPayment: false,
    stored: FULL,
  }),
  { wallet_ready: true }
);
assert.deepEqual(
  disclosePayeeWallet({
    callerIsPayingBuyer: true,
    atOnchainPayment: true,
    stored: FULL,
  }),
  { wallet_address: FULL, wallet_ready: true }
);

const expiresAt = new Date(Date.now() + 60_000).toISOString();
const challenge: WalletChallenge = {
  profile_id: 9,
  nonce: 'abc123',
  new_address: FULL,
  expires_at: expiresAt,
  used_at: null,
};
assert.equal(
  assertWalletChallengeUsable(challenge, { companyId: 9, nonce: 'abc123', address: FULL }).ok,
  true
);
assert.equal(
  assertWalletChallengeUsable(
    { ...challenge, expires_at: new Date(Date.now() - 1000).toISOString() },
    { companyId: 9, nonce: 'abc123', address: FULL }
  ).ok,
  false
);
assert.equal(
  assertWalletChallengeUsable(
    { ...challenge, used_at: new Date().toISOString() },
    { companyId: 9, nonce: 'abc123', address: FULL }
  ).ok,
  false
);

async function main() {
const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const message = buildWalletControlMessage({
  companyId: 9,
  newAddress: account.address,
  nonce: 'nonce-1',
  expiresAt,
});
assert.match(message, /SupplierAdvisor® company wallet change/);
const signature = await account.signMessage({ message });
assert.equal(
  await verifyWalletControlSignature({
    address: account.address,
    message,
    signature,
  }),
  true
);
assert.equal(
  await verifyWalletControlSignature({
    address: other.address,
    message,
    signature,
  }),
  false
);
assert.equal(
  await verifyWalletControlSignature({
    address: account.address,
    message: message + '\n',
    signature,
  }),
  false
);

const audits: WalletAuditRow[] = [];
const emails: Array<{ to: string[] }> = [];
let stored = '0x' + '11'.repeat(20);
const liveChallenge: WalletChallenge = {
  profile_id: 9,
  nonce: 'nonce-1',
  new_address: account.address,
  expires_at: expiresAt,
  used_at: null,
};
const saved = await commitCompanyWalletChange(
  {
    role: 'admin',
    challenge: liveChallenge,
    currentWallet: stored,
    recipientEmails: ['owner@example.com', 'admin@example.com'],
    setWallet: async (address) => {
      stored = address;
    },
    restoreWallet: async (address) => {
      stored = address || '';
    },
    insertAudit: async (row) => {
      audits.push(row);
    },
    markChallengeUsed: async () => undefined,
    sendEmail: async (mail) => {
      emails.push(mail);
    },
  },
  {
    companyId: 9,
    actorUserId: 'user-admin',
    newAddress: account.address,
    nonce: 'nonce-1',
    signature,
  }
);
assert.equal(saved.ok, false);
if (!saved.ok) assert.equal(saved.status, 403);
assert.equal(stored, '0x' + '11'.repeat(20));
assert.equal(audits.length, 0);
assert.equal(emails.length, 0);

const ownerSaved = await commitCompanyWalletChange(
  {
    role: 'owner',
    challenge: liveChallenge,
    currentWallet: stored,
    companyName: 'Kelpack',
    actorName: 'Ada',
    recipientEmails: ['Owner@Example.com', 'admin@example.com', 'admin@example.com'],
    setWallet: async (address) => {
      stored = address;
    },
    restoreWallet: async (address) => {
      stored = address || '';
    },
    insertAudit: async (row) => {
      audits.push(row);
    },
    markChallengeUsed: async () => {
      liveChallenge.used_at = new Date().toISOString();
    },
    sendEmail: async (mail) => {
      emails.push(mail);
    },
  },
  {
    companyId: 9,
    actorUserId: 'user-owner',
    newAddress: account.address,
    nonce: 'nonce-1',
    signature,
  }
);
assert.equal(ownerSaved.ok, true);
assert.equal(stored, account.address);
assert.equal(audits.length, 1);
assert.equal(audits[0].previous_address, '0x' + '11'.repeat(20));
assert.equal(audits[0].new_address, account.address);
assert.equal(emails.length, 1);
assert.deepEqual(emails[0].to, ['owner@example.com', 'admin@example.com']);
assert.match(walletChangeEmail({ companyName: 'Kelpack', previous: null, next: account.address }).html, /#00b4d8/);
assert.match(walletChangeEmail({ companyName: 'Kelpack', previous: null, next: account.address }).subject, /SupplierAdvisor®/);

const replay = await commitCompanyWalletChange(
  {
    role: 'owner',
    challenge: liveChallenge,
    currentWallet: stored,
    recipientEmails: ['owner@example.com'],
    setWallet: async () => {
      throw new Error('should not write');
    },
    restoreWallet: async () => undefined,
    insertAudit: async () => {
      throw new Error('should not audit');
    },
    markChallengeUsed: async () => undefined,
    sendEmail: async () => undefined,
  },
  {
    companyId: 9,
    actorUserId: 'user-owner',
    newAddress: account.address,
    nonce: 'nonce-1',
    signature,
  }
);
assert.equal(replay.ok, false);

const stripped = supplierPatchUpdates({ wallet_address: FULL, trading_name: 'Kept' }, {});
assert.equal(stripped.trading_name, 'Kept');
assert.equal('wallet_address' in stripped, false);

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const profilePage = src('app/dashboard/my-business/profile/page.tsx');
assert.doesNotMatch(profilePage, /Auto-fill wallet from login/);
assert.doesNotMatch(profilePage, /form\.wallet_address \|\| loginWallet/);
assert.doesNotMatch(profilePage, /wallet_address: wallet/);
assert.match(profilePage, /Use your connected wallet|CompanyWalletSection/);
assert.match(profilePage, /can_change_wallet|CompanyWalletSection/);

const profileRoute = src('app/api/business/profile/route.ts');
assert.match(profileRoute, /profileWalletPatchDecision/);
assert.match(profileRoute, /walletAudienceForMember/);
assert.match(profileRoute, /Only the company owner can change the payout wallet/);

const types = src('lib/business/types.ts');
assert.doesNotMatch(types, /'wallet_address',/);

const anchor = src('app/api/inventory/products/anchor/route.ts');
assert.doesNotMatch(anchor, /body\.companyWallet/);
assert.match(anchor, /assertCompanyPermission/);
assert.match(anchor, /inventory/);
assert.match(anchor, /write/);
assert.match(anchor, /loadStoredCompanyWallet/);
assert.match(anchor, /anchorCompanyWallet/);

const po = src('app/api/suppliers/purchase-orders/route.ts');
assert.doesNotMatch(po, /body\.supplier_wallet/);
assert.match(po, /loadStoredCompanyWallet/);
assert.match(po, /hidePoPayee/);

const buyerPo = src('app/api/buyer/purchase-orders/route.ts');
assert.match(buyerPo, /hidePoPayee/);
assert.match(buyerPo, /loadStoredCompanyWallet/);

const onchain = src('app/api/suppliers/purchase-orders/[id]/onchain/route.ts');
assert.doesNotMatch(onchain, /updates\.supplier_wallet = supplierWalletRaw/);
assert.match(onchain, /loadStoredCompanyWallet/);

const discover = src('app/api/suppliers/discover/route.ts');
const connections = src('app/api/connections/route.ts');
const listings = src('app/api/marketplace/listings/route.ts');
const directory = src('app/api/suppliers/directory/route.ts');
const suppliers = src('app/api/suppliers/route.ts');
const dossier = src('lib/relationship/profile-dossier.ts');
const sync = src('lib/connections/sync.ts');
const home = src('app/api/dashboard/home/route.ts');
const summary = src('app/api/dashboard/summary/route.ts');
const intelligence = src('app/api/intelligence/summary/route.ts');
for (const file of [discover, connections, listings, directory, suppliers]) {
  assert.match(file, /redactExternalWallet/);
}
assert.match(dossier, /externalWalletLabel/);
assert.doesNotMatch(dossier, /fact\('Wallet', text\(supplier\.wallet_address\)\)/);
assert.match(sync, /wallet_address: null/);
assert.match(home, /applyCompanyWalletAudience/);
assert.match(summary, /applyCompanyWalletAudience/);
assert.match(intelligence, /applyCompanyWalletAudience/);
assert.match(src('lib/http/tenant-list.ts'), /wallet_address/);
assert.match(suppliers, /redactExternalWallet/);

const migration = src(`supabase/migrations/${COMPANY_WALLET_MIGRATION}`);
assert.match(migration, /company_wallet_challenges/);
assert.match(migration, /company_wallet_audit/);
assert.match(migration, /Do not apply it to a live database/);

console.log('company wallet controls ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
