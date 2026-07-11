/**
 * Server-side POEscrow helpers (admin / scripts only).
 * Buyer and SRM UI use client-signed writeContract — never this service for user funds.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import POEscrowV2Artifact from '@/lib/contracts/abi/POEscrowV2.json';
import {
  getEscrowRpcUrl,
  getPoEscrowAddress,
  getPoEscrowChain,
} from '@/lib/contracts/escrow';
import { env } from '@/lib/env';

const POESCROW_ABI = (POEscrowV2Artifact as { abi: unknown[] }).abi;

interface CreatePOParams {
  supplier: Address;
  amount: bigint;
  metadataURI: string;
}

export class POEscrowService {
  private publicClient;
  private walletClient;
  private account;

  constructor(privateKey: string) {
    this.account = privateKeyToAccount(
      `0x${privateKey.replace('0x', '')}` as `0x${string}`
    );
    const chain = getPoEscrowChain();
    const transport = http(getEscrowRpcUrl() || env.SEPOLIA_RPC_URL);

    this.publicClient = createPublicClient({
      chain,
      transport,
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport,
    });
  }

  async createPO(params: CreatePOParams): Promise<Hash> {
    const { supplier, amount, metadataURI } = params;
    return this.walletClient.writeContract({
      address: getPoEscrowAddress(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abi: POESCROW_ABI as any,
      functionName: 'createPO',
      args: [supplier, amount, metadataURI],
    });
  }

  async fundPO(poId: bigint, amountInEth: string): Promise<Hash> {
    return this.walletClient.writeContract({
      address: getPoEscrowAddress(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abi: POESCROW_ABI as any,
      functionName: 'fundPO',
      args: [poId],
      value: parseEther(amountInEth),
    });
  }

  async markShipped(poId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      address: getPoEscrowAddress(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abi: POESCROW_ABI as any,
      functionName: 'markShipped',
      args: [poId],
    });
  }

  async confirmDelivery(poId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      address: getPoEscrowAddress(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abi: POESCROW_ABI as any,
      functionName: 'confirmDelivery',
      args: [poId],
    });
  }

  /** @deprecated Use confirmDelivery — Hardhat POEscrowV2 has no releaseFunds */
  async releaseFunds(poId: bigint): Promise<Hash> {
    return this.confirmDelivery(poId);
  }

  async getPO(poId: bigint) {
    return this.publicClient.readContract({
      address: getPoEscrowAddress(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abi: POESCROW_ABI as any,
      functionName: 'getPO',
      args: [poId],
    });
  }
}

let _svc: POEscrowService | null = null;

export function getPOEscrowService(): POEscrowService {
  if (_svc) return _svc;
  const pk = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('PRIVATE_KEY required for POEscrowService');
  _svc = new POEscrowService(pk);
  return _svc;
}

export const poEscrowService = {
  get createPO() {
    return getPOEscrowService().createPO.bind(getPOEscrowService());
  },
  get fundPO() {
    return getPOEscrowService().fundPO.bind(getPOEscrowService());
  },
  get confirmDelivery() {
    return getPOEscrowService().confirmDelivery.bind(getPOEscrowService());
  },
  get releaseFunds() {
    return getPOEscrowService().releaseFunds.bind(getPOEscrowService());
  },
  get markShipped() {
    return getPOEscrowService().markShipped.bind(getPOEscrowService());
  },
};
