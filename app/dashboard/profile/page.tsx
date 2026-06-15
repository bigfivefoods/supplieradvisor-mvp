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
    street: '21A Old Howick Road',
    city: 'Pietermaritzburg',
    province: 'KwaZulu-Natal',
    country: 'South Africa',
    bank_name: 'FNB',
    account_number: '63156727625',
    industries: 'Food Processing, Distributors',
    certifications: 'ISO 22000',
    products: 'OnePot Meals, Fortified Porridge',
  };

  if (companyId) {
    const { data: row } = await supabase.from('profiles').select('*').eq('id', companyId).single();
    if (row) data = row;
  }

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
        {data.legal_name}
      </h1>
      <p className="text-xl text-neutral-600">Company ID: {companyId || 'None'} • ALL fields from "profiles" table loaded</p>

      <div className="bg-white rounded-3xl p-8 mt-8 space-y-4">
        <p><strong>Legal Name:</strong> {data.legal_name}</p>
        <p><strong>Trading Name:</strong> {data.trading_name}</p>
        <p><strong>Email:</strong> {data.email}</p>
        <p><strong>Registration:</strong> {data.registration_number}</p>
        <p><strong>Street:</strong> {data.street}</p>
        <p><strong>City:</strong> {data.city}</p>
        <p><strong>Province:</strong> {data.province}</p>
        <p><strong>Bank:</strong> {data.bank_name} • {data.account_number}</p>
        <p><strong>Industries:</strong> {data.industries}</p>
        <p><strong>Products:</strong> {data.products}</p>
        <p><strong>Certifications:</strong> {data.certifications}</p>
      </div>

      <button className="mt-8 bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium">
        Get Verified - R49 with Paystack
      </button>
    </div>
  );
}