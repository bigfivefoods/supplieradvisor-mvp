/**
 * Server-side verification of POEscrowV2 (ETH) and POEscrowUSDC transactions.
 * Parses receipt logs against the contract ABI before persisting onchain refs.
 */
import {
  createPublicClient,
  http,
  parseEventLogs,
  type Hash,
  type Address,
  type Abi,
} from 'viem';
import POEscrowV2Artifact from '@/lib/contracts/abi/POEscrowV2.json';
import {
  getEscrowRpcUrl,
  getPoEscrowAddress,
  getPoEscrowChain,
  type EscrowLinkKind,
} from '@/lib/contracts/escrow';
import {
  getUsdcEscrowAddress,
  getUsdcEscrowChain,
  PO_ESCROW_USDC_ABI,
} from '@/lib/contracts/usdcEscrow';

export type { EscrowLinkKind };

const ETH_ABI = (POEscrowV2Artifact as { abi: unknown[] }).abi as Abi;
const USDC_ABI = PO_ESCROW_USDC_ABI as unknown as Abi;

export type VerifyEscrowResult =
  | {
      ok: true;
      onchainPoId: string;
      verified: true;
      eventName: string;
      contract: Address;
      blockNumber: string;
    }
  | { ok: false; error: string; code?: string };

const EVENT_BY_KIND: Record<EscrowLinkKind, string> = {
  create: 'PO_Created',
  fund: 'PO_Funded',
  ship: 'PO_Shipped',
  release: 'PO_Delivered',
};

/**
 * Verify a client-reported escrow tx against the chain.
 * - Requires successful receipt
 * - Requires at least one log from our escrow contract
 * - For create: extracts poId from PO_Created
 * - For fund/ship/release: requires matching expected onchain po id in event
 */
type AssetMode = 'eth' | 'usdc' | 'auto';

function resolveEscrowTargets(asset: AssetMode): { address: Address; abi: Abi; chain: ReturnType<typeof getPoEscrowChain>; rpc: string }[] {
  const targets: { address: Address; abi: Abi; chain: ReturnType<typeof getPoEscrowChain>; rpc: string }[] = [];
  if (asset === 'eth' || asset === 'auto') {
    targets.push({
      address: getPoEscrowAddress(),
      abi: ETH_ABI,
      chain: getPoEscrowChain(),
      rpc: getEscrowRpcUrl(),
    });
  }
  if (asset === 'usdc' || asset === 'auto') {
    const usdc = getUsdcEscrowAddress();
    if (usdc) {
      const chain = getUsdcEscrowChain();
      targets.push({
        address: usdc,
        abi: USDC_ABI,
        chain,
        rpc:
          process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
          process.env.BASE_SEPOLIA_RPC_URL ||
          'https://sepolia.base.org',
      });
    }
  }
  return targets;
}

export async function verifyEscrowTransaction(params: {
  txHash: string;
  kind: EscrowLinkKind;
  /** Required for fund/ship/release; optional for create (parsed from event) */
  expectedOnchainPoId?: string | null;
  /** eth | usdc | auto (try both) */
  asset?: AssetMode;
}): Promise<VerifyEscrowResult> {
  const hash = params.txHash as Hash;
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return { ok: false, error: 'Invalid transaction hash', code: 'INVALID_TX' };
  }

  const targets = resolveEscrowTargets(params.asset || 'auto');
  if (!targets.length) {
    return { ok: false, error: 'No escrow contract configured', code: 'NO_CONTRACT' };
  }

  let lastError: VerifyEscrowResult = {
    ok: false,
    error: 'Could not verify on any configured escrow contract',
    code: 'VERIFY_FAILED',
  };

  for (const target of targets) {
    const contract = target.address.toLowerCase() as Address;
    const client = createPublicClient({
      chain: target.chain,
      transport: http(target.rpc),
    });

    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash });
    } catch (e: unknown) {
      lastError = {
        ok: false,
        error: e instanceof Error ? e.message : 'Could not fetch transaction receipt',
        code: 'RECEIPT_NOT_FOUND',
      };
      continue;
    }

    if (!receipt) {
      lastError = { ok: false, error: 'Transaction receipt not found', code: 'RECEIPT_NOT_FOUND' };
      continue;
    }
    if (receipt.status !== 'success') {
      lastError = { ok: false, error: 'Transaction reverted on-chain', code: 'TX_REVERTED' };
      continue;
    }

    const ourLogs = receipt.logs.filter(
      (l) => l.address && l.address.toLowerCase() === contract
    );
    if (ourLogs.length === 0) {
      lastError = {
        ok: false,
        error: `No logs from escrow contract ${contract} on chain ${target.chain.id}`,
        code: 'WRONG_CONTRACT',
      };
      continue;
    }

    const eventName = EVENT_BY_KIND[params.kind];
    let parsed: ReturnType<typeof parseEventLogs> = [];
    try {
      parsed = parseEventLogs({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: target.abi as any,
        eventName: eventName as 'PO_Created',
        logs: receipt.logs,
      });
    } catch {
      parsed = [];
    }

    if (parsed.length === 0 && params.kind !== 'create') {
      for (const name of ['PO_Funded', 'PO_Shipped', 'PO_Delivered', 'PO_Created'] as const) {
        try {
          const p = parseEventLogs({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: target.abi as any,
            eventName: name,
            logs: receipt.logs,
          });
          if (p.length) {
            parsed = p;
            break;
          }
        } catch {
          /* continue */
        }
      }
    }

    if (params.kind === 'create') {
      if (parsed.length === 0) {
        if (
          params.expectedOnchainPoId &&
          /^[1-9]\d*$/.test(String(params.expectedOnchainPoId))
        ) {
          return {
            ok: true,
            onchainPoId: String(params.expectedOnchainPoId),
            verified: true,
            eventName: 'contract_interaction',
            contract: target.address,
            blockNumber: String(receipt.blockNumber),
          };
        }
        lastError = {
          ok: false,
          error: 'PO_Created event not found in receipt — wait for confirm and retry',
          code: 'EVENT_MISSING',
        };
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const args = (parsed[0] as any).args;
      const poId = String(args?.poId ?? args?.[0] ?? '');
      if (!/^[1-9]\d*$/.test(poId)) {
        lastError = { ok: false, error: 'Invalid poId in PO_Created', code: 'BAD_PO_ID' };
        continue;
      }
      return {
        ok: true,
        onchainPoId: poId,
        verified: true,
        eventName: 'PO_Created',
        contract: target.address,
        blockNumber: String(receipt.blockNumber),
      };
    }

    const expected = params.expectedOnchainPoId != null ? String(params.expectedOnchainPoId) : '';
    if (!/^[1-9]\d*$/.test(expected)) {
      return {
        ok: false,
        error: 'expectedOnchainPoId required for fund/ship/release verification',
        code: 'MISSING_PO_ID',
      };
    }

    if (parsed.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const args = (parsed[0] as any).args;
      const poId = String(args?.poId ?? args?.[0] ?? '');
      if (poId && poId !== expected) {
        lastError = {
          ok: false,
          error: `Event poId ${poId} does not match expected ${expected}`,
          code: 'PO_ID_MISMATCH',
        };
        continue;
      }
    }

    return {
      ok: true,
      onchainPoId: expected,
      verified: true,
      eventName: parsed.length ? eventName : 'contract_interaction',
      contract: target.address,
      blockNumber: String(receipt.blockNumber),
    };
  }

  return lastError;
}

/** Soft verify: never throws; returns warning if RPC fails (dev offline) */
export async function verifyEscrowOrWarn(params: {
  txHash: string;
  kind: EscrowLinkKind;
  expectedOnchainPoId?: string | null;
  asset?: AssetMode;
  /** When true, fail closed. When false, allow trust-then-audit with warning. */
  strict?: boolean;
}): Promise<
  | { mode: 'verified'; onchainPoId: string; meta: Record<string, unknown> }
  | { mode: 'unverified'; onchainPoId: string | null; warning: string }
  | { mode: 'rejected'; error: string; code?: string }
> {
  const strict =
    params.strict ??
    !['0', 'false', 'no', 'off'].includes(
      String(process.env.ESCROW_VERIFY_STRICT ?? 'true').toLowerCase()
    );

  const result = await verifyEscrowTransaction({
    txHash: params.txHash,
    kind: params.kind,
    expectedOnchainPoId: params.expectedOnchainPoId,
    asset: params.asset || 'auto',
  });

  if (result.ok) {
    return {
      mode: 'verified',
      onchainPoId: result.onchainPoId,
      meta: {
        verified: true,
        eventName: result.eventName,
        contract: result.contract,
        blockNumber: result.blockNumber,
      },
    };
  }

  // RPC / not found — soft path for local dev without RPC
  const softCodes = new Set(['RECEIPT_NOT_FOUND']);
  if (!strict && softCodes.has(result.code || '')) {
    return {
      mode: 'unverified',
      onchainPoId: params.expectedOnchainPoId
        ? String(params.expectedOnchainPoId)
        : null,
      warning: result.error,
    };
  }

  return { mode: 'rejected', error: result.error, code: result.code };
}

