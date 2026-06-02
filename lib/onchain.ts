import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';

const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC)
});

export async function mintVerificationSBT(profileId: string, metadataHash: string) {
  console.log('🔗 Minting SBT for profile', profileId, metadataHash);
  // TODO: Call your deployed SBT contract here
  return { txHash: '0x...' };
}

export async function uploadToIPFS(file: File | Blob): Promise<string> {
  console.log('📤 Uploading to IPFS via Pinata');
  // TODO: Add Pinata fetch call using PINATA_JWT from .env
  return 'ipfs://Qm...';
}

export { publicClient };