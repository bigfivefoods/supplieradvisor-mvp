/**
 * Canonical POEscrowV2 client config.
 *
 * Single source of truth: Hardhat contract (create → fund → markShipped → confirmDelivery).
 * Foundry variant in contracts/src is archival — do not mix ABIs.
 */
import { sepolia, baseSepolia, base } from 'viem/chains';
import type { Address, Chain } from 'viem';

/** Ethereum Sepolia — matches Hardhat deploy in contracts/contracts/deployments */
export const ESCROW_CHAIN_SEPOLIA = sepolia;

export const ESCROW_CHAINS = {
  11155111: sepolia,
  84532: baseSepolia,
  8453: base,
} as const;

/** Hardhat POEscrowV2 on Ethereum Sepolia (2026-06-23 deploy) */
export const DEFAULT_PO_ESCROW_ADDRESS =
  '0x1a0a30b07ad50b5373a088d5c81dbbf3e644a06f' as const satisfies Address;

export const DEFAULT_PO_ESCROW_CHAIN_ID = 11155111;

export function getPoEscrowAddress(): Address {
  const raw =
    process.env.NEXT_PUBLIC_PO_ESCROW_ADDRESS ||
    process.env.PO_ESCROW_ADDRESS ||
    DEFAULT_PO_ESCROW_ADDRESS;
  return raw as Address;
}

export function getPoEscrowChainId(): number {
  const raw =
    process.env.NEXT_PUBLIC_PO_ESCROW_CHAIN_ID ||
    process.env.PO_ESCROW_CHAIN_ID ||
    String(DEFAULT_PO_ESCROW_CHAIN_ID);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PO_ESCROW_CHAIN_ID;
}

export function getPoEscrowChain(): Chain {
  const id = getPoEscrowChainId();
  return (ESCROW_CHAINS as Record<number, Chain>)[id] || sepolia;
}

export function getEscrowRpcUrl(): string {
  const chainId = getPoEscrowChainId();
  if (chainId === 8453 || chainId === 84532) {
    return (
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
      process.env.BASE_SEPOLIA_RPC_URL ||
      process.env.SEPOLIA_RPC_URL ||
      'https://sepolia.base.org'
    );
  }
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC ||
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
    'https://rpc.sepolia.org'
  );
}

/** Explorer tx URL for the configured escrow chain */
export function escrowTxUrl(txHash: string): string {
  const chain = getPoEscrowChain();
  const base =
    chain.blockExplorers?.default?.url ||
    (chain.id === 11155111 ? 'https://sepolia.etherscan.io' : 'https://sepolia.basescan.org');
  return `${base}/tx/${txHash}`;
}

export function escrowAddressUrl(address: string): string {
  const chain = getPoEscrowChain();
  const base =
    chain.blockExplorers?.default?.url ||
    (chain.id === 11155111 ? 'https://sepolia.etherscan.io' : 'https://sepolia.basescan.org');
  return `${base}/address/${address}`;
}

/**
 * Demo ETH conversion for fundPO msg.value when PO is in ZAR/fiat.
 * Override with NEXT_PUBLIC_ETH_DEMO_RATE (fiat per 1 ETH).
 * Production: use oracle or explicit ETH amount field.
 */
export function getEthDemoRateFiat(): number {
  const n = Number(process.env.NEXT_PUBLIC_ETH_DEMO_RATE || process.env.ETH_DEMO_RATE || 55000);
  return Number.isFinite(n) && n > 0 ? n : 55000;
}

export function fiatToEthString(fiatAmount: number, rate = getEthDemoRateFiat()): string {
  if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) return '0.000001';
  const eth = fiatAmount / rate;
  // Minimum dust so fundPO never sends 0
  return Math.max(eth, 0.000001).toFixed(6);
}

/** Canonical lifecycle for Hardhat POEscrowV2 */
export const ESCROW_LIFECYCLE = [
  { step: 1, fn: 'createPO', role: 'buyer', label: 'Create on-chain PO' },
  { step: 2, fn: 'fundPO', role: 'buyer', label: 'Fund escrow (ETH)' },
  { step: 3, fn: 'markShipped', role: 'supplier', label: 'Mark shipped' },
  { step: 4, fn: 'confirmDelivery', role: 'buyer', label: 'Confirm delivery → pay supplier' },
] as const;

export type EscrowLinkKind = 'create' | 'fund' | 'ship' | 'release';

export function isEscrowConfigured(): boolean {
  const addr = getPoEscrowAddress();
  return Boolean(addr && addr.startsWith('0x') && addr.length === 42);
}
