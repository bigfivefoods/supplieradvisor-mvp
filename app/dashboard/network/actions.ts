'use server';

import { createClient } from '@supabase/supabase-js';

interface Company {
  id: number;
  role: string;
  status: string;
  joined_at: string;
  profiles: {
    id: number;
    trading_name: string;
    legal_name: string | null;
    registration_number: string | null;
    vat_number: string | null;
    tax_number: string | null;
    city: string | null;
    country: string | null;
    verification_status: string | null;
    logo_url: string | null;
  } | null;
}

export async function fetchUserCompanies(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!   // ← Uses Service Role (bypasses RLS securely)
  );

  const { data, error } = await supabase
    .from('business_users')
    .select(`
      id,
      role,
      status,
      joined_at,
      profiles:profile_id (
        id,
        trading_name,
        legal_name,
        registration_number,
        vat_number,
        tax_number,
        city,
        country,
        verification_status,
        logo_url
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });

  if (error) {
    console.error('Server Action Error:', error);
    return { companies: [], error: error.message };
  }

  return { 
    companies: (data as unknown as Company[]) || [], 
    error: null 
  };
}