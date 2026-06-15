export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';

export default async function MyBusinessProfile({ searchParams }: { searchParams: { companyId?: string } }) {
  const companyId = searchParams.companyId;

  let companyData = {
    legal_name: 'Big Five Foods',
    trading_name: 'BFF',
    contact_name: 'Dr Craig Muller',
    email: 'craig@bigfivefoods.com',
    registration_number: '2025/123456/07',
  };

  if (companyId) {
    const { data } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('id', companyId)
      .single();

    if (data) {
      companyData = data;
    }
  }

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
        {companyData.legal_name}
      </h1>
      <p className="text-xl text-neutral-600">Company ID: {companyId || 'None'} • Loaded from Supabase</p>

      <div className="bg-white rounded-3xl p-8 mt-8">
        <h3 className="font-bold mb-4">Company Details</h3>
        <p><strong>Legal Name:</strong> {companyData.legal_name}</p>
        <p><strong>Email:</strong> {companyData.email}</p>
        <p><strong>Registration:</strong> {companyData.registration_number}</p>
      </div>

      <div className="mt-8">
        <button className="bg-green-600 text-white px-8 py-3 rounded-xl text-lg font-medium">
          Get Verified - R49 with Paystack
        </button>
      </div>
    </div>
  );
}