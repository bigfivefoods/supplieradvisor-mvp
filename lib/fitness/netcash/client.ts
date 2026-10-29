import type { BatchLineResult } from '@/lib/fitness/netcash/types';
import type { BatchRow } from '@/lib/fitness/netcash/batch';

/**
 * Netcash transport. This build never opens a socket.
 * Test mode uses a deterministic mock. Live mode is refused.
 * GYM_NETCASH_ALLOW_NETWORK does not enable HTTP in this build.
 */

export type ValidationRequest = { accountNumber: string; branchCode: string; accountType: string; accountHolder: string };

export type NetcashClient = {
  mode: 'test' | 'live' | 'blocked';
  validateAccount(input: ValidationRequest & { accountServiceKey?: string }): Promise<{ ok: true; status: 'valid' | 'invalid' | 'error'; ref: string; message: string } | { ok: false; error: string }>;
  uploadMasterfile(input: { sha256: string; count: number; fileBody?: string }): Promise<{ ok: true; batchId: string } | { ok: false; error: string }>;
  submitDebitBatch(input: { sha256: string; actionDate: string; rows: Array<Pick<BatchRow, 'netcashRef' | 'amountCents' | 'accountNumber'>>; fileBody?: string }): Promise<{ ok: true; batchId: string } | { ok: false; error: string }>;
  fetchResults(input: { batchId: string; actionDate?: string; accountServiceKey?: string; rows: Array<Pick<BatchRow, 'netcashRef' | 'accountNumber'> & { memberId?: string; invoiceNumber?: string }> }): Promise<{ ok: true; results: BatchLineResult[] } | { ok: false; error: string }>;
};

const LIVE_ERROR = 'Live Netcash calls are disabled. Keep the gym in test mode. No money is sent.';

export function createNetcashClient(mode: 'test' | 'live'): NetcashClient {
  if (mode === 'live') return blocked(LIVE_ERROR);
  return mockClient();
}

function blocked(error: string): NetcashClient {
  const fail = async () => ({ ok: false as const, error });
  return {
    mode: 'blocked',
    validateAccount: fail,
    uploadMasterfile: fail,
    submitDebitBatch: fail,
    fetchResults: fail,
  };
}

function mockClient(): NetcashClient {
  return {
    mode: 'test',
    async validateAccount(input) {
      const { mockAccountValidation } = await import('@/lib/fitness/netcash/validate');
      const result = mockAccountValidation(input.accountNumber, input.branchCode);
      return { ok: true, status: result.status, ref: result.ref, message: result.message };
    },
    async uploadMasterfile(input) {
      return { ok: true, batchId: `MF-TEST-${input.sha256.slice(0, 12)}` };
    },
    async submitDebitBatch(input) {
      return { ok: true, batchId: `DO-TEST-${input.actionDate.replace(/-/g, '')}-${input.sha256.slice(0, 8)}` };
    },
    async fetchResults(input) {
      return {
        ok: true,
        results: input.rows.map((row) => mockOutcome(row.netcashRef, row.accountNumber)),
      };
    },
  };
}

/** Last digit of the account chooses the test outcome so runs are repeatable. */
export function mockOutcome(netcashRef: string, accountNumber: string): BatchLineResult {
  const digit = accountNumber.replace(/\D/g, '').slice(-1);
  if (digit === '0') return { netcashRef, outcome: 'unpaid', reasonCode: '02' };
  if (digit === '1') return { netcashRef, outcome: 'unpaid', reasonCode: '12' };
  if (digit === '2') return { netcashRef, outcome: 'unpaid', reasonCode: '26' };
  if (digit === '3') return { netcashRef, outcome: 'reversed', reasonCode: '28' };
  return { netcashRef, outcome: 'paid', reasonCode: '00' };
}
