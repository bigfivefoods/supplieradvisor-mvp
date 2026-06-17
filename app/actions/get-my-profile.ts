'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function getMyProfileId(privyUserId: string) {
  if (!privyUserId) return null;

  // Clean the ID (remove 'privy:' prefix if present)
  const cleanId = privyUserId.replace('privy:', '');

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', cleanId)
    .single();

  if (error || !data) {
    console.error('getMyProfileId error:', error);
    return null;
  }

  return data.id as number;
}