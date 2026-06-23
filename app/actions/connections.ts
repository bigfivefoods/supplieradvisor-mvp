'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export type ConnectionStatus = 'none' | 'pending' | 'connected' | 'rejected' | 'revoked';

type SyncConnectionParams = {
  profileIdA: number;
  profileIdB: number;
  status: ConnectionStatus;
  initiatedBy?: number;
  txHash?: string;
  blockNumber?: number;
};

/**
 * Syncs the connection status to Supabase after a successful onchain transaction.
 */
export async function syncConnectionToDatabase(params: SyncConnectionParams) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('company_connections')
      .upsert(
        {
          profile_id_a: params.profileIdA,
          profile_id_b: params.profileIdB,
          status: params.status,
          initiated_by: params.initiatedBy,
          onchain_tx_hash: params.txHash,
          onchain_block_number: params.blockNumber,
          connected_at: params.status === 'connected' ? new Date().toISOString() : null,
          revoked_at: params.status === 'revoked' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'profile_id_a,profile_id_b',
        }
      );

    if (error) {
      console.error('[syncConnectionToDatabase] Supabase error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/network');
    revalidatePath('/connections');

    return { success: true };
  } catch (err: any) {
    console.error('[syncConnectionToDatabase] Unexpected error:', err);
    return { success: false, error: err.message || 'Unknown error occurred' };
  }
}

/**
 * Get the current connection status between two profiles
 */
export async function getConnectionStatus(profileIdA: number, profileIdB: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('company_connections')
    .select('*')
    .or(
      `and(profile_id_a.eq.${profileIdA},profile_id_b.eq.${profileIdB}),` +
      `and(profile_id_a.eq.${profileIdB},profile_id_b.eq.${profileIdA})`
    )
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[getConnectionStatus] Error:', error);
    return null;
  }

  return data;
}

/**
 * Get connection statuses for multiple profiles at once (efficient for lists)
 */
export async function getConnectionStatuses(
  currentProfileId: number,
  targetProfileIds: number[]
): Promise<Map<number, ConnectionStatus>> {
  if (targetProfileIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('company_connections')
    .select('profile_id_a, profile_id_b, status')
    .or(
      `and(profile_id_a.eq.${currentProfileId},profile_id_b.in.(${targetProfileIds.join(',')})),` +
      `and(profile_id_b.eq.${currentProfileId},profile_id_a.in.(${targetProfileIds.join(',')}))`
    );

  if (error) {
    console.error('[getConnectionStatuses] Error:', error);
    return new Map();
  }

  const statusMap = new Map<number, ConnectionStatus>();

  data?.forEach((conn: any) => {
    const otherId =
      conn.profile_id_a === currentProfileId
        ? conn.profile_id_b
        : conn.profile_id_a;

    statusMap.set(otherId, conn.status as ConnectionStatus);
  });

  return statusMap;
}