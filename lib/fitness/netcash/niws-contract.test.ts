/**
 * Recorded Netcash NIWS responses. No network.
 * Run: npx tsx lib/fitness/netcash/niws-contract.test.ts
 */
import assert from 'node:assert/strict';
import { buildDebitBatchFile, buildMasterfile, NETCASH_PUBLIC_VENDOR_KEY } from './batch';
import { createNiwsCaller, readStatement, resultsFromStatement, uploadNiwsFile, validateWithNetcash, type NiwsFetch } from './niws-http';
import { assertNiwsCall, NIWS_NIF_URL, soapEnvelope } from './niws-soap';

const KEY = '00000000-0000-4000-8000-000000000001';
const ACCOUNT_KEY = '00000000-0000-4000-8000-000000000002';
const BATCH = '00000000-0000-4000-8000-0000000000aa';

const file = buildDebitBatchFile({
  serviceKey: KEY,
  actionDate: '2026-11-02',
  batchName: 'GYM 2026-11',
  rows: [{
    netcashRef: 'G901000001',
    accountName: 'Amahle Nkosi',
    accountHolder: 'A Nkosi',
    accountType: 'cheque',
    branchCode: '051001',
    accountNumber: '1002003014',
    amountCents: 89000,
    memberId: 'm_paid',
    invoiceNumber: 'GYM-00041',
  }],
});
const lines = file.body.trim().split('\n');
assert.deepEqual(lines[0].split('\t'), ['H', KEY, '1', 'TwoDay', 'GYM 2026-11', '20261102', NETCASH_PUBLIC_VENDOR_KEY]);
assert.deepEqual(lines[1].split('\t'), ['K', '101', '102', '131', '132', '133', '134', '135', '136', '162', '301', '302']);
assert.deepEqual(lines[2].split('\t'), ['T', 'G901000001', 'Amahle Nkosi', '1', 'A Nkosi', '1', '051001', '0', '1002003014', '89000', 'm_paid', 'GYM-00041']);
assert.deepEqual(lines[3].split('\t'), ['F', '1', '89000', '9999']);

const master = buildMasterfile({
  serviceKey: KEY,
  batchName: 'Master G901000001',
  actionDate: '2026-10-02',
  mandates: [{
    netcashRef: 'G901000001',
    memberName: 'Amahle Nkosi',
    accountHolder: 'A Nkosi',
    accountType: 'savings',
    branchCode: '051001',
    accountNumber: '1002003014',
    amountCents: 89000,
  }],
});
assert.match(master.body, /K\t101\t102\t131\t132\t133\t134\t135\t136\t161/);
assert.match(master.body, /\tUpdate\t/);
assert.match(master.body, /F\t1\t89000\t9999/);

assert.equal(assertNiwsCall({ url: 'https://evil.example/NIWS/niws_nif.svc', mode: 'test', companyId: 901, allowNetwork: true, allowLive: false, allowCompany110: false }).ok, false);
assert.equal(assertNiwsCall({ url: NIWS_NIF_URL, mode: 'live', companyId: 901, allowNetwork: true, allowLive: false, allowCompany110: false }).ok, false);
assert.equal(assertNiwsCall({ url: NIWS_NIF_URL, mode: 'test', companyId: 110, allowNetwork: true, allowLive: false, allowCompany110: false }).ok, false);
assert.equal(assertNiwsCall({ url: NIWS_NIF_URL, mode: 'test', companyId: 901, allowNetwork: false, allowLive: false, allowCompany110: false }).ok, false);
assert.equal(assertNiwsCall({ url: NIWS_NIF_URL, mode: 'test', companyId: 901, allowNetwork: true, allowLive: false, allowCompany110: false }).ok, true);

async function main() {
const seen: string[] = [];
const fetchImpl: NiwsFetch = async (url, init) => {
  seen.push(`${url} ${init.headers.SOAPAction}`);
  assert.equal(url.startsWith('https://ws.netcash.co.za/'), true);
  const action = init.headers.SOAPAction;
  if (action.includes('BatchFileUpload')) {
    assert.match(init.body, /TwoDay/);
    assert.equal(init.body.includes(KEY), true);
    return { status: 200, body: `<BatchFileUploadResult>20000000.2550236530.0483.2.2</BatchFileUploadResult>` };
  }
  if (action.includes('RequestFileUploadReport')) {
    return { status: 200, body: `<RequestFileUploadReportResult>###BEGIN GYM 2026-11 SUCCESSFUL 09:00 AM R890.00 20261102\n###END 09:00 AM</RequestFileUploadReportResult>` };
  }
  if (action.includes('RequestDebitBatchUnauthorised')) {
    return { status: 200, body: `<RequestDebitBatchUnauthorisedResult>${BATCH}\tGYM 2026-11\t1</RequestDebitBatchUnauthorisedResult>` };
  }
  if (action.includes('RequestBatchAuthorise')) {
    assert.match(init.body, new RegExp(`<BatchIndicator>${BATCH}</BatchIndicator>`));
    assert.match(init.body, /<ReleaseFunds>false<\/ReleaseFunds>/);
    return { status: 200, body: `<RequestBatchAuthoriseResult>AUTHORISED</RequestBatchAuthoriseResult>` };
  }
  if (action.includes('RequestMerchantStatement')) {
    return { status: 200, body: `<RequestMerchantStatementResult>poll-1</RequestMerchantStatementResult>` };
  }
  if (action.includes('RetrieveMerchantStatement')) {
    const statement = [
      '20261102\tTDD\t9001\tTwo day debit order\t890.0000\t+\t0\tm_paid\tGYM-00041\tG901000001',
      '20261102\tDRU\t9002\tDebit order unpaid Code:02\t890.0000\t-\t0\tm_retry\tGYM-00042\tG901000002',
    ].join('\n');
    return { status: 200, body: `<RetrieveMerchantStatementResult>${statement}</RetrieveMerchantStatementResult>` };
  }
  if (action.includes('ValidateBankAccount')) {
    return { status: 200, body: `<ValidateBankAccountResult>${init.body.includes('1002003014') ? '0' : '2'}</ValidateBankAccountResult>` };
  }
  return { status: 500, body: '' };
};

const flags = { allowNetwork: () => true, allowLive: () => false, allowCompany110: () => false };
const caller = createNiwsCaller({ fetchImpl, mode: 'test', companyId: 901, flags });
const uploaded = await uploadNiwsFile(caller, KEY, file.body, 'GYM 2026-11');
assert.equal(uploaded.ok, true);
if (uploaded.ok) assert.equal(uploaded.fileToken, '20000000.2550236530.0483.2.2');

const statement = await readStatement(caller, ACCOUNT_KEY, '2026-11-02');
assert.equal(statement.ok, true);
if (statement.ok) {
  const results = resultsFromStatement(statement.body, [
    { netcashRef: 'G901000001', memberId: 'm_paid', invoiceNumber: 'GYM-00041' },
    { netcashRef: 'G901000002', memberId: 'm_retry', invoiceNumber: 'GYM-00042' },
  ]);
  assert.deepEqual(results.map((row) => [row.netcashRef, row.outcome, row.reasonCode]), [
    ['G901000001', 'paid', '00'],
    ['G901000002', 'unpaid', '02'],
  ]);
}

const valid = await validateWithNetcash(caller, { accountServiceKey: ACCOUNT_KEY, accountNumber: '1002003014', branchCode: '051001', accountType: '1' });
assert.equal(valid.ok && valid.status, 'valid');
const invalid = await validateWithNetcash(caller, { accountServiceKey: ACCOUNT_KEY, accountNumber: '1002003010', branchCode: '051001', accountType: '1' });
assert.equal(invalid.ok && invalid.status, 'invalid');

const live = createNiwsCaller({ fetchImpl, mode: 'live', companyId: 901, flags });
const refused = await live.call('BatchFileUpload', { ServiceKey: KEY, File: 'x' }, 'nif');
assert.equal(refused.ok, false);

assert.match(soapEnvelope('BatchFileUpload', { ServiceKey: KEY, File: 'A&B' }), /A&amp;B/);
assert.equal(seen.some((line) => line.startsWith('https://ws.netcash.co.za/NIWS/niws_nif.svc')), true);
assert.equal(seen.some((line) => line.includes('evil')), false);

console.log('niws-contract.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
