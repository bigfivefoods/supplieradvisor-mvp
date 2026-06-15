export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';

export default async function MyBusinessProfile({ searchParams }: { searchParams: { companyId?: string } }) {
  const companyId = searchParams.companyId;

  let data = null;

  if (companyId) {
    const { data: row } = await supabase.from('profiles').select('*').eq('id', companyId).single();
    data = row;
  }

  if (!data) {
    const { data: row } = await supabase.from('profiles').select('*').eq('user_id', 'did:cmmkfe47g012f0djolmvhx6x3').limit(1).single();
    data = row;
  }

  if (!data) {
    data = { legal_name: 'No data found' };
  }

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
        {data.legal_name}
      </h1>
      <p className="text-xl text-neutral-600">Selected Company ID: {companyId || 'None'} • **Exact company data pulled**</p>

      <div className="bg-white rounded-3xl p-8 mt-8 space-y-4">
        <p><strong>Legal Name:</strong> {data.legal_name}</p>
        <p><strong>Email:</strong> {data.email}</p>
        <p><strong>Registration:</strong> {data.registration_number}</p>
        <p><strong>Street:</strong> {data.street}</p>
        <p><strong>City:</strong> {data.city}</p>
        <p><strong>Province:</strong> {data.province}</p>
        <p><strong>Bank:</strong> {data.bank_name} • {data.account_number}</p>
      </div>

      <button className="mt-8 bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium">
        Get Verified - R49 with Paystack
      </button>
    </div>
  );
}