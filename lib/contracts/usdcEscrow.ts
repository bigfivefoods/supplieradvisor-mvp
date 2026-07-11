/**
 * USDC (ERC-20) PO escrow on Base / Base Sepolia.
 * Pair with POEscrowUSDC.sol — same lifecycle as ETH POEscrowV2 but fund via approve + transferFrom.
 */
import { base, baseSepolia } from 'viem/chains';
import type { Address, Chain } from 'viem';

/** Circle USDC on Base Sepolia (public testnet) */
export const USDC_BASE_SEPOLIA =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const satisfies Address;

/** Native USDC on Base mainnet */
export const USDC_BASE =
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const satisfies Address;

export const DEFAULT_USDC_ESCROW_CHAIN_ID = 84532; // Base Sepolia

export function getUsdcEscrowChainId(): number {
  const raw =
    process.env.NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID ||
    process.env.USDC_ESCROW_CHAIN_ID ||
    String(DEFAULT_USDC_ESCROW_CHAIN_ID);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USDC_ESCROW_CHAIN_ID;
}

export function getUsdcEscrowChain(): Chain {
  return getUsdcEscrowChainId() === 8453 ? base : baseSepolia;
}

export function getUsdcTokenAddress(): Address {
  const raw =
    process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
    process.env.USDC_TOKEN_ADDRESS ||
    '';
  if (raw && raw.startsWith('0x') && raw.length === 42) return raw as Address;
  return getUsdcEscrowChainId() === 8453 ? USDC_BASE : USDC_BASE_SEPOLIA;
}

export function getUsdcEscrowAddress(): Address | null {
  const raw =
    process.env.NEXT_PUBLIC_USDC_ESCROW_ADDRESS ||
    process.env.USDC_ESCROW_ADDRESS ||
    '';
  if (!raw || !raw.startsWith('0x') || raw.length < 42) return null;
  return raw as Address;
}

export function isUsdcEscrowConfigured(): boolean {
  return getUsdcEscrowAddress() != null;
}

/** Prefer USDC path when flag on and contract address set */
export function isUsdcEscrowEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_USDC_ESCROW_ENABLED ??
    process.env.USDC_ESCROW_ENABLED;
  if (raw === undefined || raw === '') {
    // Auto-enable UI when contract address is present
    return isUsdcEscrowConfigured();
  }
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase().trim());
}

export const USDC_DECIMALS = 6;

/** Convert fiat display amount to USDC base units (assumes 1:1 USD or demo FX) */
export function fiatToUsdcUnits(
  fiatAmount: number,
  opts?: { fiatPerUsd?: number; decimals?: number }
): bigint {
  const dec = opts?.decimals ?? USDC_DECIMALS;
  const fx = opts?.fiatPerUsd && opts.fiatPerUsd > 0 ? opts.fiatPerUsd : 18; // rough ZAR/USD demo
  // If currency is already USD-like, fiatPerUsd=1
  const usd = fiatAmount / fx;
  const scaled = Math.round(usd * 10 ** dec);
  return BigInt(Math.max(scaled, 1));
}

export function usdcUnitsToDisplay(units: bigint, decimals = USDC_DECIMALS): string {
  const n = Number(units) / 10 ** decimals;
  return n.toFixed(Math.min(2, decimals));
}

/** Minimal ERC-20 + POEscrowUSDC ABI fragments for wagmi */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

export const PO_ESCROW_USDC_ABI = [
  {
    type: 'function',
    name: 'createPO',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_supplier', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_metadataURI', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'fundPO',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_poId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'markShipped',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_poId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'confirmDelivery',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_poId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getPO',
    stateMutability: 'view',
    inputs: [{ name: '_poId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'buyer', type: 'address' },
          { name: 'supplier', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'metadataURI', type: 'string' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'fundedAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'PO_Created',
    inputs: [
      { name: 'poId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'supplier', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PO_Funded',
    inputs: [
      { name: 'poId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PO_Shipped',
    inputs: [{ name: 'poId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'PO_Delivered',
    inputs: [{ name: 'poId', type: 'uint256', indexed: true }],
  },
] as const;
