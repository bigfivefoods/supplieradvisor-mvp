export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';

export default async function MyBusinessProfile({ searchParams }: { searchParams: { companyId?: string } }) {
  const companyId = searchParams.companyId;

  let data = {
    legal_name: 'Big Five Foods',
    trading_name: 'BFF',
    contact_name: 'Dr Craig Muller',
    email: 'craig@bigfivefoods.com',
    registration_number: '2025/123456/07',
  };

  if (companyId) {
    const { data: row } = await supabase.from('profiles').select('*').eq('id', companyId).single();
    if (row) data = row;
  }

  return (
    <div className="p-12">
      <h1 className="text-5xl font-black text-[#00b4d8]">{data.legal_name}</h1>
      <p>Company ID: {companyId || 'None'} • Loaded from Supabase</p>
      <p>Email: {data.email}</p>
      <p>Registration: {data.registration_number}</p>
      <button className="mt-8 bg-green-600 text-white px-8 py-3 rounded-xl">Get Verified - R49 with Paystack</button>
    </div>
  );
}