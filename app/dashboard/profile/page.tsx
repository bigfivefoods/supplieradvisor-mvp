export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';

export default async function MyBusinessProfile({ searchParams }: { searchParams: { companyId?: string } }) {
  const rawId = searchParams.companyId;
  const companyId = rawId ? Number(rawId) : null; // handles bigint/int ids safely

  let data: any = null;
  let debugInfo = `Raw companyId from URL: ${rawId || 'missing'}`;

  if (companyId && !isNaN(companyId)) {
    const { data: row, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error) {
      console.error('Supabase error loading company:', error);
      debugInfo += ` | Supabase error: ${error.message}`;
    } else {
      data = row;
    }
  }

  // Fallback only if no valid ID or query failed
  if (!data) {
    const { data: row } = await supabase.from('profiles').select('*').limit(1).single();
    data = row || { legal_name: 'No company data found' };
    debugInfo += ' | Using fallback (first record)';
  }

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
        {data.legal_name}
      </h1>

      <p className="text-xl text-neutral-600 mt-2">
        Selected Company ID: {companyId || 'None'} • {debugInfo}
      </p>

      <div className="bg-white rounded-3xl p-8 mt-8 space-y-4">
        <p><strong>Legal Name:</strong> {data.legal_name}</p>
        <p><strong>Trading Name:</strong> {data.trading_name}</p>
        <p><strong>Email:</strong> {data.email}</p>
        <p><strong>Registration Number:</strong> {data.registration_number}</p>
        <p><strong>Street:</strong> {data.street}</p>
        <p><strong>City:</strong> {data.city}</p>
        <p><strong>Province:</strong> {data.province}</p>
        <p><strong>Bank:</strong> {data.bank_name} • {data.account_number}</p>
        <p><strong>Business Type:</strong> {data.business_type}</p>
      </div>

      <div className="mt-8">
        <button className="bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium">
          Get Verified - R69 with Paystack
        </button>
      </div>
    </div>
  );
}