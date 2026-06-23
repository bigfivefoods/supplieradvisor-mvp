import { sepolia } from 'viem/chains';

export const CHAIN = sepolia;

export const CONTRACTS = {
  POEscrowV2: {
    address: '0xDCB5bBF409DCbf54124C02a11a6518e3a8ddd61c' as const, // Sepolia
    // Add mainnet address later when deployed
  },
  // CompanyConnectionRegistry: { ... }  // we can add later
} as const;