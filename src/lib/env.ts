export const env = {
  PRIVATE_KEY: process.env.PRIVATE_KEY!,
  SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL!,
} as const;

// Basic validation
if (!env.PRIVATE_KEY) {
  throw new Error('Missing PRIVATE_KEY in environment variables');
}

if (!env.SEPOLIA_RPC_URL) {
  throw new Error('Missing SEPOLIA_RPC_URL in environment variables');
}