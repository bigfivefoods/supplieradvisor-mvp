#!/usr/bin/env node
/**
 * Deploy POEscrowUSDC to Base Sepolia (or Base) via viem.
 *
 * Usage:
 *   PRIVATE_KEY=0x... BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
 *   USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
 *   node scripts/deploy-usdc-escrow.mjs
 *
 * Requires solc-compiled artifact at:
 *   contracts/contracts/artifacts/contracts/POEscrowUSDC.sol/POEscrowUSDC.json
 * Or set ARTIFACT_PATH.
 *
 * If artifact missing, prints env template and exits 0 with instructions.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createWalletClient,
  createPublicClient,
  http,
  encodeDeployData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pk = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const chainId = Number(process.env.USDC_ESCROW_CHAIN_ID || process.env.NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID || 84532);
const token =
  process.env.USDC_TOKEN_ADDRESS ||
  process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
  (chainId === 8453
    ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    : '0x036CbD53842c5426634e7929541eC2318f3dCF7e');
const rpc =
  process.env.BASE_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
  (chainId === 8453 ? 'https://mainnet.base.org' : 'https://sepolia.base.org');

const artifactCandidates = [
  process.env.ARTIFACT_PATH,
  join(root, 'contracts/contracts/artifacts/contracts/POEscrowUSDC.sol/POEscrowUSDC.json'),
  join(root, 'out/POEscrowUSDC.sol/POEscrowUSDC.json'),
].filter(Boolean);

function loadArtifact() {
  for (const p of artifactCandidates) {
    if (p && existsSync(p)) {
      return { path: p, json: JSON.parse(readFileSync(p, 'utf8')) };
    }
  }
  return null;
}

async function main() {
  console.log('=== Deploy POEscrowUSDC ===');
  console.log('chainId', chainId, 'token', token);

  const art = loadArtifact();
  if (!art) {
    console.log(`
No compiled artifact found. Compile first:

  cd contracts/contracts && npx hardhat compile

Or with forge (if configured for this file).

Then re-run this script. Env template after deploy:

NEXT_PUBLIC_USDC_ESCROW_ENABLED=true
NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID=${chainId}
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=${token}
NEXT_PUBLIC_USDC_ESCROW_ADDRESS=<deployed>
`);
    process.exit(0);
  }

  if (!pk) {
    console.error('PRIVATE_KEY required to deploy');
    process.exit(1);
  }

  const abi = art.json.abi;
  const bytecode = art.json.bytecode?.object || art.json.bytecode;
  if (!bytecode || bytecode === '0x') {
    console.error('Artifact missing bytecode at', art.path);
    process.exit(1);
  }

  const chain = chainId === 8453 ? base : baseSepolia;
  const key = (pk.startsWith('0x') ? pk : `0x${pk}`);
  const account = privateKeyToAccount(key);
  const transport = http(rpc);
  const wallet = createWalletClient({ account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });

  const data = encodeDeployData({
    abi,
    bytecode: bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`,
    args: [token],
  });

  console.log('Deploying from', account.address);
  const hash = await wallet.sendTransaction({ data, chain });
  console.log('tx', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  console.log('POEscrowUSDC deployed at', address);

  const outDir = join(root, 'contracts/contracts/deployments');
  mkdirSync(outDir, { recursive: true });
  const out = {
    network: chain.name,
    chainId,
    contract: 'POEscrowUSDC',
    address,
    token,
    txHash: hash,
    deployer: account.address,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(join(outDir, `usdc-escrow-${chainId}.json`), JSON.stringify(out, null, 2));
  console.log(`
Set on Vercel:

NEXT_PUBLIC_USDC_ESCROW_ENABLED=true
NEXT_PUBLIC_USDC_ESCROW_CHAIN_ID=${chainId}
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=${token}
NEXT_PUBLIC_USDC_ESCROW_ADDRESS=${address}
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
