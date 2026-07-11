# USDC PO escrow on Base

## Contract

- Source: `contracts/contracts/contracts/POEscrowUSDC.sol`
- Token: ERC-20 USDC (6 decimals)
- Lifecycle: `createPO` → `approve` (ERC-20) → `fundPO` → `markShipped` → `confirmDelivery`

## Deploy

```bash
# 1. Compile (Hardhat in contracts/contracts)
cd contracts/contracts && npx hardhat compile

# 2. Deploy to Base Sepolia
cd ../..
PRIVATE_KEY=0x... \
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
USDC_ESCROW_CHAIN_ID=84532 \
npm run deploy:usdc-escrow
```

Writes `contracts/contracts/deployments/usdc-escrow-84532.json`.

## Vercel env

```bash
NEXT_PUBLIC_USDC_ESCROW_ENABLED=true
NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID=84532
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_USDC_ESCROW_ADDRESS=0x...   # from deploy output
NEXT_PUBLIC_ZAR_PER_USD=18             # demo fiat→USDC only
```

## App wiring

| Piece | Path |
|-------|------|
| Config + ABI | `lib/contracts/usdcEscrow.ts` |
| UI | `components/onchain/UsdcEscrowActions.tsx` + PO page toggle |
| Receipt verify | `lib/contracts/verifyEscrow.ts` (asset `usdc` / `auto`) |
| Fund email | `lib/notifications/email-alerts.ts` → `notifyEscrowFunded` |

ETH escrow remains available on Sepolia (`lib/contracts/escrow.ts`). Prefer **USDC on Base** for realistic B2B demos.
