# USDC PO escrow on Base

## Contract

- Source: `contracts/contracts/contracts/POEscrowUSDC.sol`
- Token: ERC-20 USDC (6 decimals)
- Lifecycle: `createPO` → `approve` (ERC-20) → `fundPO` → `markShipped` → `confirmDelivery`

## Deploy (example)

```bash
# Base Sepolia USDC (Circle): 0x036CbD53842c5426634e7929541eC2318f3dCF7e
# Pass token address to constructor
```

Set:

```bash
NEXT_PUBLIC_USDC_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID=84532
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_USDC_ESCROW_ENABLED=true
```

## App wiring

- Config: `lib/contracts/usdcEscrow.ts`
- UI helper: `components/onchain/UsdcEscrowActions.tsx`
- ETH escrow remains default on Sepolia (`lib/contracts/escrow.ts`)
- Prefer USDC for production B2B settlement demos on Base

## Notes

- Buyer must hold test USDC and approve the escrow contract for `amount` base units
- Server onchain link APIs still verify receipts when using ETH path; USDC path should use the same pattern with USDC ABI events after deploy
