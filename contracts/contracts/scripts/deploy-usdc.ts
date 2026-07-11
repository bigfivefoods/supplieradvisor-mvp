/**
 * Deploy POEscrowUSDC to Base Sepolia (or Base).
 *
 *   cd contracts/contracts
 *   BASE_SEPOLIA_RPC_URL=... SEPOLIA_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-usdc.ts
 *
 * Uses viem wallet client (Hardhat 3 toolbox style compatible).
 */
import { createWalletClient, createPublicClient, http, encodeDeployData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '../../.env.local') });
dotenv.config();

const chainId = Number(process.env.USDC_ESCROW_CHAIN_ID || 84532);
const token =
  process.env.USDC_TOKEN_ADDRESS ||
  (chainId === 8453
    ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    : '0x036CbD53842c5426634e7929541eC2318f3dCF7e');

let rawKey =
  process.env.SEPOLIA_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  process.env.DEPLOYER_PRIVATE_KEY ||
  '';
rawKey = rawKey.replace(/['"]/g, '').trim();
if (rawKey && !rawKey.startsWith('0x')) rawKey = '0x' + rawKey;

const rpc =
  process.env.BASE_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
  (chainId === 8453 ? 'https://mainnet.base.org' : 'https://sepolia.base.org');

async function main() {
  const artifactPath = join(
    process.cwd(),
    'artifacts',
    'contracts',
    'POEscrowUSDC.sol',
    'POEscrowUSDC.json'
  );
  if (!existsSync(artifactPath)) {
    throw new Error(`Compile first: npx hardhat compile (missing ${artifactPath})`);
  }
  if (!rawKey || rawKey.length < 66) {
    throw new Error('Set SEPOLIA_PRIVATE_KEY or PRIVATE_KEY (0x… 32-byte key)');
  }

  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const bytecode = (artifact.bytecode?.object || artifact.bytecode) as string;
  if (!bytecode || bytecode === '0x') throw new Error('Empty bytecode');

  const chain = chainId === 8453 ? base : baseSepolia;
  const account = privateKeyToAccount(rawKey as `0x${string}`);
  const transport = http(rpc);
  const wallet = createWalletClient({ account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });

  console.log('Deployer', account.address);
  console.log('Chain', chain.name, chainId);
  console.log('USDC token', token);

  const data = encodeDeployData({
    abi: artifact.abi,
    bytecode: (bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`) as `0x${string}`,
    args: [token as `0x${string}`],
  });

  const hash = await wallet.sendTransaction({ data, chain });
  console.log('tx', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress!;
  console.log('✅ POEscrowUSDC', address);

  const depDir = join(process.cwd(), 'deployments');
  if (!existsSync(depDir)) mkdirSync(depDir, { recursive: true });
  const payload = {
    network: chain.name,
    chainId,
    contract: 'POEscrowUSDC',
    address,
    token,
    txHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    deployer: account.address,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(join(depDir, `usdc-escrow-${chainId}.json`), JSON.stringify(payload, null, 2));

  // Export ABI for Next app
  const abiDir = join(process.cwd(), '../../src/lib/contracts/abi');
  if (!existsSync(abiDir)) mkdirSync(abiDir, { recursive: true });
  writeFileSync(join(abiDir, 'POEscrowUSDC.json'), JSON.stringify(artifact, null, 2));

  console.log(`
Vercel / .env.local:

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
