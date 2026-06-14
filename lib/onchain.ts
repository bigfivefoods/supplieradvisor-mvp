import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { supabase } from './supabase';

const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC),
});

export async function uploadToIPFS(metadata: any): Promise<string> {
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataOptions: { cidVersion: 1 }
    }),
  });
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

export async function mintVerificationSBT(profileId: string, metadata: any) {
  const ipfsHash = await uploadToIPFS(metadata);

  const { data, error } = await supabase
    .from('profiles')
    .update({
      on_chain_hash: ipfsHash,
      sbt_token_id: Date.now().toString(),
      verified_at: new Date().toISOString(),
      attestation_id: ipfsHash
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export { publicClient };