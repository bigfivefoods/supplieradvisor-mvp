import {
  createWalletClient,
  createPublicClient,
  http,
  type Hex,
  type Address,
  keccak256,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { InventoryPassportABI } from '@/lib/contracts/InventoryPassportABI';

/** Convert SHA-256 hex (64 chars) to bytes32-compatible 0x hash (pad if needed). */
export function sha256ToBytes32(sha256Hex: string): Hex {
  const clean = sha256Hex.replace(/^0x/, '').toLowerCase();
  if (clean.length !== 64) {
    // keccak fallback for non-sha lengths
    return keccak256(toBytes(sha256Hex));
  }
  return `0x${clean}` as Hex;
}

export function getInventoryChain() {
  const id = process.env.NEXT_PUBLIC_INVENTORY_CHAIN_ID || process.env.INVENTORY_CHAIN_ID || '84532';
  return id === '8453' ? base : baseSepolia;
}

export function getInventoryPassportAddress(): Address | null {
  const addr =
    process.env.NEXT_PUBLIC_INVENTORY_PASSPORT_ADDRESS ||
    process.env.INVENTORY_PASSPORT_ADDRESS ||
    '';
  if (!addr || !addr.startsWith('0x') || addr.length < 10) return null;
  return addr as Address;
}

export function getRpcUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
    process.env.BASE_SEPOLIA_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    'https://sepolia.base.org'
  );
}

/**
 * Server-side anchor of product identity on InventoryPassport.
 * Requires PRIVATE_KEY (minter) and INVENTORY_PASSPORT_ADDRESS.
 */
export async function anchorProductOnChain(params: {
  identityHashSha256: string;
  publicId: string;
  companyWallet?: string | null;
}): Promise<
  | { ok: true; txHash: Hex; tokenId?: string; chainId: number; mode: 'onchain' }
  | { ok: true; mode: 'simulated'; txHash: string; tokenId: string; chainId: number; note: string }
  | { ok: false; error: string }
> {
  const contract = getInventoryPassportAddress();
  const pk = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  const chain = getInventoryChain();
  const identityHash = sha256ToBytes32(params.identityHashSha256);

  if (!contract || !pk) {
    // Simulated anchor so product flow works before deploy
    const simTx = keccak256(
      toBytes(`${params.publicId}:${params.identityHashSha256}:${Date.now()}`)
    );
    return {
      ok: true,
      mode: 'simulated',
      txHash: simTx,
      tokenId: String(BigInt('0x' + params.identityHashSha256.slice(0, 12))),
      chainId: chain.id,
      note: !contract
        ? 'INVENTORY_PASSPORT_ADDRESS not set — simulated anchor. Deploy InventoryPassport.sol and set env.'
        : 'PRIVATE_KEY not set — simulated anchor. Add minter key to mint for real.',
    };
  }

  try {
    const key = (pk.startsWith('0x') ? pk : `0x${pk}`) as Hex;
    const account = privateKeyToAccount(key);
    const transport = http(getRpcUrl());
    const wallet = createWalletClient({ account, chain, transport });
    const publicClient = createPublicClient({ chain, transport });

    const company = (params.companyWallet && params.companyWallet.startsWith('0x')
      ? params.companyWallet
      : account.address) as Address;

    const hash = await wallet.writeContract({
      address: contract,
      abi: InventoryPassportABI,
      functionName: 'anchorProduct',
      args: [identityHash, company, params.publicId],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return {
      ok: true,
      mode: 'onchain',
      txHash: hash,
      tokenId: receipt.status === 'success' ? undefined : undefined,
      chainId: chain.id,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'On-chain anchor failed',
    };
  }
}

export async function readProductAnchor(identityHashSha256: string) {
  const contract = getInventoryPassportAddress();
  if (!contract) return null;
  const chain = getInventoryChain();
  const publicClient = createPublicClient({ chain, transport: http(getRpcUrl()) });
  try {
    const result = await publicClient.readContract({
      address: contract,
      abi: InventoryPassportABI,
      functionName: 'getProduct',
      args: [sha256ToBytes32(identityHashSha256)],
    });
    return result;
  } catch {
    return null;
  }
}
