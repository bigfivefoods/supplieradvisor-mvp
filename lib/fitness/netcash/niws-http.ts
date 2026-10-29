import type { BatchLineResult } from '@/lib/fitness/netcash/types';
import { batchGuidForName, parseLoadReport, parseStatement, statementToResults, validationMeaning } from '@/lib/fitness/netcash/niws-parse';
import {
  assertNiwsCall,
  isNiwsErrorCode,
  NIWS_NIF_URL,
  NIWS_VALIDATION_URL,
  niwsErrorText,
  soapAction,
  soapEnvelope,
  soapResult,
} from '@/lib/fitness/netcash/niws-soap';

export type NiwsFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; body: string }>;

export type NiwsCaller = {
  call(method: string, fields: Record<string, string | boolean>, service: 'nif' | 'validation'): Promise<{ ok: true; value: string } | { ok: false; error: string }>;
};

const FLAGS = {
  allowNetwork: () => process.env.GYM_NETCASH_ALLOW_NETWORK === '1',
  allowLive: () => process.env.GYM_NETCASH_ALLOW_LIVE === '1',
  allowCompany110: () => process.env.GYM_NETCASH_ALLOW_COMPANY_110 === '1',
};

export function createNiwsCaller(input: {
  fetchImpl: NiwsFetch;
  mode: 'test' | 'live';
  companyId: number;
  flags?: typeof FLAGS;
}): NiwsCaller {
  const flags = input.flags || FLAGS;
  return {
    async call(method, fields, service) {
      const url = service === 'validation' ? NIWS_VALIDATION_URL : NIWS_NIF_URL;
      const gate = assertNiwsCall({
        url,
        mode: input.mode,
        companyId: input.companyId,
        allowNetwork: flags.allowNetwork(),
        allowLive: flags.allowLive(),
        allowCompany110: flags.allowCompany110(),
      });
      if (!gate.ok) return gate;
      const action = soapAction(service === 'validation' ? 'INIWS_Validation' : 'INIWS_NIF', method);
      const response = await input.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${action}"`,
        },
        body: soapEnvelope(method, fields),
      });
      if (response.status < 200 || response.status >= 300) {
        return { ok: false, error: 'Netcash did not accept the request.' };
      }
      const value = soapResult(response.body, method);
      if (!value) return { ok: false, error: 'Netcash returned an empty response.' };
      if (isNiwsErrorCode(value) || value === 'FILE NOT READY') return { ok: false, error: niwsErrorText(value) };
      return { ok: true, value };
    },
  };
}

export async function uploadNiwsFile(caller: NiwsCaller, serviceKey: string, file: string, batchName: string): Promise<{ ok: true; fileToken: string; batchGuid: string } | { ok: false; error: string }> {
  const uploaded = await caller.call('BatchFileUpload', { ServiceKey: serviceKey, File: file }, 'nif');
  if (!uploaded.ok) return uploaded;
  const report = await caller.call('RequestFileUploadReport', { ServiceKey: serviceKey, FileToken: uploaded.value }, 'nif');
  if (!report.ok) return report;
  const parsed = parseLoadReport(report.value);
  if (parsed.result === 'UNSUCCESSFUL' || parsed.result === 'UNKNOWN') {
    return { ok: false, error: parsed.errors[0] || 'Netcash rejected the batch file.' };
  }
  const listed = await caller.call('RequestDebitBatchUnauthorised', { ServiceKey: serviceKey, Date: '' }, 'nif');
  const batchGuid = listed.ok ? batchGuidForName(listed.value, batchName) : null;
  if (!batchGuid) return { ok: false, error: 'Netcash accepted the file but did not return a batch id to authorise.' };
  const authorised = await caller.call(
    'RequestBatchAuthorise',
    {
      ServiceKey: serviceKey,
      BatchIndicator: batchGuid,
      SendEmail: false,
      FromName: '',
      FromAddress: '',
      SendSMS: false,
      ReleaseFunds: false,
      BankTransfer: false,
    },
    'nif'
  );
  if (!authorised.ok) return authorised;
  return { ok: true, fileToken: uploaded.value, batchGuid };
}

export async function readStatement(caller: NiwsCaller, accountServiceKey: string, actionDate: string): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const requested = await caller.call('RequestMerchantStatement', { ServiceKey: accountServiceKey, FromActionDate: actionDate.replace(/-/g, '') }, 'nif');
  if (!requested.ok) return requested;
  const retrieved = await caller.call('RetrieveMerchantStatement', { ServiceKey: accountServiceKey, PollingId: requested.value }, 'nif');
  if (!retrieved.ok) return retrieved;
  return { ok: true, body: retrieved.value };
}

export function resultsFromStatement(body: string, rows: Array<{ netcashRef: string; memberId: string; invoiceNumber: string }>): BatchLineResult[] {
  return statementToResults(parseStatement(body), rows);
}

export async function validateWithNetcash(
  caller: NiwsCaller,
  input: { accountServiceKey: string; accountNumber: string; branchCode: string; accountType: string }
): Promise<{ ok: true; status: 'valid' | 'invalid' | 'error'; ref: string; message: string } | { ok: false; error: string }> {
  const result = await caller.call(
    'ValidateBankAccount',
    {
      ServiceKey: input.accountServiceKey,
      AccountNumber: input.accountNumber,
      BranchCode: input.branchCode,
      AccountType: input.accountType,
    },
    'validation'
  );
  if (!result.ok) return result;
  const meaning = validationMeaning(result.value);
  return { ok: true, status: meaning.status, ref: meaning.status === 'valid' ? `NIWS-${input.accountNumber.slice(-4)}` : '', message: meaning.message };
}
