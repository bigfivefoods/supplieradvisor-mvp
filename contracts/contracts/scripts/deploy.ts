import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config();

let rawKey = process.env.SEPOLIA_PRIVATE_KEY || "";
rawKey = rawKey.replace(/['"]/g, "").trim();
if (!rawKey.startsWith("0x")) rawKey = "0x" + rawKey;

const RPC_URL = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = rawKey as `0x${string}`;

if (!RPC_URL || PRIVATE_KEY.length !== 66) {
  throw new Error("Invalid SEPOLIA_RPC_URL or SEPOLIA_PRIVATE_KEY");
}

const account = privateKeyToAccount(PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(RPC_URL),
});

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

async function main() {
  console.log("Deploying POEscrowV2 to Sepolia...");
  console.log("Deployer:", account.address);

  const artifactPath = join(process.cwd(), "artifacts", "contracts", "POEscrowV2.sol", "POEscrowV2.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
  });

  console.log("Transaction hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress!;

  console.log(`✅ POEscrowV2 deployed to: ${address}`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed}`);

  const deploymentDir = join(process.cwd(), "deployments");
  if (!existsSync(deploymentDir)) mkdirSync(deploymentDir, { recursive: true });

  writeFileSync(
    join(deploymentDir, "sepolia.json"),
    JSON.stringify({
      network: "sepolia",
      contract: "POEscrowV2",
      address,
      txHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      deployer: account.address,
      deployedAt: new Date().toISOString(),
    }, null, 2)
  );

  console.log("📄 Deployment saved to deployments/sepolia.json");

  // Export ABI
  try {
    const targetDir = join(process.cwd(), "..", "..", "src", "lib", "contracts", "abi");
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "POEscrowV2.json"), JSON.stringify(artifact, null, 2));
    console.log("📦 ABI exported to Next.js");
  } catch {}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
