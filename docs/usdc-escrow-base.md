# USDC PO escrow on Base

## Contract

- Source: `contracts/contracts/contracts/POEscrowUSDC.sol`
- Token: ERC-20 USDC (6 decimals)
- Lifecycle: `createPO` → `approve` (ERC-20) → `fundPO` → `markShipped` → `confirmDelivery`

## Deploy

```bash
# 1. Compile + deploy (from repo root)
cd contracts/contracts
npx hardhat compile

SEPOLIA_PRIVATE_KEY=0x... \
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
npx tsx scripts/deploy-usdc.ts

# Or from root:
# npm run deploy:usdc-hardhat
```

Also: `npm run deploy:usdc-escrow` (viem script using compiled artifact).

Writes:
- `contracts/contracts/deployments/usdc-escrow-84532.json`
- `src/lib/contracts/abi/POEscrowUSDC.json`


## Vercel env

```bash
NEXT_PUBLIC_USDC_ESCROW_ENABLED=true
NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID=84532
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_USDC_ESCROW_ADDRESS=0x...   # from deploy output
NEXT_PUBLIC_ZAR_PER_USD=18             # demo fiat→USDC only
```

## Base mainnet (production crypto — optional)

Only when you have a real treasury process (not for day-to-day ZAR AR):

```bash
NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID=8453
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # native USDC on Base
NEXT_PUBLIC_USDC_ESCROW_ADDRESS=0x...   # your mainnet deploy
NEXT_PUBLIC_USDC_ESCROW_ENABLED=true
```

Checklist:

1. Deploy `POEscrowUSDC` to Base mainnet with a controlled owner key  
2. Multisig / hardware wallet for owner  
3. Document fund→ship→confirm runbook for support  
4. Keep **Money hub** default for SA ZAR settle  

UI: `/dashboard/escrow` (under Suppliers nav).

## App wiring

| Piece | Path |
|-------|------|
| Config + ABI | `lib/contracts/usdcEscrow.ts` |
| UI | `components/onchain/UsdcEscrowActions.tsx` + PO page toggle |
| Receipt verify | `lib/contracts/verifyEscrow.ts` (asset `usdc` / `auto`) |
| Fund email | `lib/notifications/email-alerts.ts` → `notifyEscrowFunded` |

ETH escrow remains available on Sepolia (`lib/contracts/escrow.ts`). Prefer **USDC on Base** for realistic B2B demos.
