/**
 * Re-export canonical escrow config (Hardhat POEscrowV2 on Sepolia by default).
 * Override with NEXT_PUBLIC_PO_ESCROW_ADDRESS / NEXT_PUBLIC_PO_ESCROW_CHAIN_ID.
 */
import {
  getPoEscrowAddress,
  getPoEscrowChainId,
  getPoEscrowChain,
  DEFAULT_PO_ESCROW_ADDRESS,
} from '@/lib/contracts/escrow';

export const CHAIN = getPoEscrowChain();
export const CHAIN_ID = getPoEscrowChainId();

export const CONTRACTS = {
  POEscrowV2: {
    address: getPoEscrowAddress() as typeof DEFAULT_PO_ESCROW_ADDRESS,
    chainId: getPoEscrowChainId(),
  },
} as const;
