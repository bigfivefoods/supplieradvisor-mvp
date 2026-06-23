import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther, 
  type Address, 
  type Hash,
  type TransactionReceipt 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { loadAbi } from './loadAbi';
import { CONTRACTS } from './config';
import { env } from '@/lib/env';

const POESCROW_ABI = loadAbi('POEscrowV2');

// ==================== TYPES ====================

interface CreatePOParams {
  supplier: Address;
  amount: bigint;
  description: string;
  deadline: bigint;
}

export interface PO {
  id: bigint;
  buyer: Address;
  supplier: Address;
  amount: bigint;
  description: string;
  deadline: bigint;
  status: number;
  fundedAmount: bigint;
  supplierConfirmedDelivery: boolean;
  buyerApprovedRelease: boolean;
}

// ==================== SERVICE ====================

export class POEscrowService {
  private publicClient;
  private walletClient;
  private account;

  constructor(privateKey: string) {
    this.account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);

    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(env.SEPOLIA_RPC_URL),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: sepolia,
      transport: http(env.SEPOLIA_RPC_URL),
    });
  }

  // ==================== WRITE FUNCTIONS ====================

  async createPO(params: CreatePOParams): Promise<Hash> {
    const { supplier, amount, description, deadline } = params;

    return this.walletClient.writeContract({
      address: CONTRACTS.POEscrowV2.address,
      abi: POESCROW_ABI,
      functionName: 'createPO',
      args: [supplier, amount, description, deadline],
    });
  }

  async fundPO(poId: bigint, amountInEth: string): Promise<Hash> {
    return this.walletClient.writeContract({
      address: CONTRACTS.POEscrowV2.address,
      abi: POESCROW_ABI,
      functionName: 'fundPO',
      args: [poId],
      value: parseEther(amountInEth),
    });
  }

  async confirmDelivery(poId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      address: CONTRACTS.POEscrowV2.address,
      abi: POESCROW_ABI,
      functionName: 'confirmDelivery',
      args: [poId],
    });
  }

  async releaseFunds(poId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      address: CONTRACTS.POEscrowV2.address,
      abi: POESCROW_ABI,
      functionName: 'releaseFunds',
      args: [poId],
    });
  }

  // ==================== READ FUNCTIONS ====================

  async getPO(poId: bigint): Promise<PO> {
    type POData = readonly [
      bigint, Address, Address, bigint, string, bigint, number, bigint, boolean, boolean
    ];

    const result = (await this.publicClient.readContract({
      address: CONTRACTS.POEscrowV2.address,
      abi: POESCROW_ABI,
      functionName: 'getPO',
      args: [poId],
    })) as POData;

    return {
      id: result[0],
      buyer: result[1],
      supplier: result[2],
      amount: result[3],
      description: result[4],
      deadline: result[5],
      status: Number(result[6]),
      fundedAmount: result[7],
      supplierConfirmedDelivery: result[8],
      buyerApprovedRelease: result[9],
    };
  }

  async getPOStatus(poId: bigint): Promise<number> {
    const status = await this.publicClient.readContract({
      address: CONTRACTS.POEscrowV2.address,
      abi: POESCROW_ABI,
      functionName: 'getPOStatus',
      args: [poId],
    });
    return Number(status);
  }

  async getPOCounter(): Promise<bigint> {
    const counter = await this.publicClient.readContract({
      address: CONTRACTS.POEscrowV2.address,
      abi: POESCROW_ABI,
      functionName: 'poCounter',
    });
    return counter as bigint;
  }

  // ==================== TRANSACTION HELPERS ====================

  async waitForTransaction(hash: Hash): Promise<TransactionReceipt> {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  // ==================== CONVENIENCE METHODS (Write + Wait) ====================

  async createPOAndWait(params: CreatePOParams) {
    const hash = await this.createPO(params);
    const receipt = await this.waitForTransaction(hash);
    return { hash, receipt };
  }

  async fundPOAndWait(poId: bigint, amountInEth: string) {
    const hash = await this.fundPO(poId, amountInEth);
    const receipt = await this.waitForTransaction(hash);
    return { hash, receipt };
  }

  async confirmDeliveryAndWait(poId: bigint) {
    const hash = await this.confirmDelivery(poId);
    const receipt = await this.waitForTransaction(hash);
    return { hash, receipt };
  }

  async releaseFundsAndWait(poId: bigint) {
    const hash = await this.releaseFunds(poId);
    const receipt = await this.waitForTransaction(hash);
    return { hash, receipt };
  }
}

// ==================== DEFAULT INSTANCE ====================

export const poEscrowService = new POEscrowService(env.PRIVATE_KEY);