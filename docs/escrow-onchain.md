# POEscrowV2 — on-chain purchase order escrow

## Canonical contract

| Item | Value |
|------|--------|
| Source of truth | `contracts/contracts/contracts/POEscrowV2.sol` (Hardhat) |
| ABI | `src/lib/contracts/abi/POEscrowV2.json` |
| Default address | `0x1a0a30b07ad50b5373a088d5c81dbbf3e644a06f` (Ethereum Sepolia) |
| Config | `lib/contracts/escrow.ts` + env overrides |

**Do not use** the Foundry variant in `contracts/src/POEscrowV2.sol` for the app — different ABI (`releaseFunds` vs `confirmDelivery`).

## Lifecycle

1. **createPO**(supplier, amountWei, metadataURI) — buyer  
2. **fundPO**(poId) payable — buyer locks ETH  
3. **markShipped**(poId) — **supplier** wallet only  
4. **confirmDelivery**(poId) — buyer; transfers escrow to supplier  

Optional: **raiseDispute** / **resolveDispute** (owner).

## Raising POs (UI)

**Suppliers → Purchase orders** (`/dashboard/suppliers/po`):

| Type | Button | Needs wallet? |
|------|--------|----------------|
| **Standard PO** | Send standard PO | No |
| **Escrow PO** | Send escrow PO | Yes + supplier 0x |

Choose **Standard PO** or **Escrow PO** in the type selector, fill lines, then use the matching button.

## Feature flags

```bash
# SRM path /dashboard/suppliers/po — default ON (omit or set true)
# SUPPLIER_PO_ESCROW_ENABLED=true
# NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED=true

# Disable escrow only:
# NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED=false
# SUPPLIER_PO_ESCROW_ENABLED=false

# Customer portal /dashboard/buyer/pos — default OFF
CUSTOMER_PO_ESCROW_ENABLED=true
NEXT_PUBLIC_CUSTOMER_PO_ESCROW_ENABLED=true
```

Supplier escrow **defaults to enabled**. Rebuild after changing `NEXT_PUBLIC_*`.

## Chain & wallet

- Wagmi chains include **Sepolia**, Base Sepolia, Base.
- Escrow chain id: `NEXT_PUBLIC_PO_ESCROW_CHAIN_ID` (default `11155111`).
- UI: `WalletConnectBar` forces correct network before signing.
- Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for wallet login.

## Server verification

`POST .../onchain` calls `verifyEscrowOrWarn` (`lib/contracts/verifyEscrow.ts`):

- Loads receipt from RPC  
- Requires logs from escrow contract  
- Parses `PO_Created` / `PO_Funded` / `PO_Shipped` / `PO_Delivered`  
- Strict mode default (`ESCROW_VERIFY_STRICT=true`)

## Demo funding amount

Fiat PO totals convert with `NEXT_PUBLIC_ETH_DEMO_RATE` (default 55000 ZAR/ETH). **Not for production treasury** — use an oracle or explicit ETH field later (stablecoin path recommended).

## Inventory passport (separate)

- Chain: Base / Base Sepolia  
- Simulated when address/key missing — UI labels **simulated** vs **minted**
