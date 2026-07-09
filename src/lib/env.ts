/**
 * Server-side env helpers for on-chain services.
 * Values are read lazily so importing this module during build does not crash
 * when optional blockchain secrets are not configured.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  get PRIVATE_KEY(): string {
    const value = read('PRIVATE_KEY');
    if (!value) {
      throw new Error('Missing PRIVATE_KEY in environment variables');
    }
    return value;
  },
  get SEPOLIA_RPC_URL(): string {
    const value = read('SEPOLIA_RPC_URL') || read('NEXT_PUBLIC_BASE_SEPOLIA_RPC');
    if (!value) {
      throw new Error('Missing SEPOLIA_RPC_URL in environment variables');
    }
    return value;
  },
  get hasChainConfig(): boolean {
    return Boolean(read('PRIVATE_KEY') && (read('SEPOLIA_RPC_URL') || read('NEXT_PUBLIC_BASE_SEPOLIA_RPC')));
  },
} as const;
