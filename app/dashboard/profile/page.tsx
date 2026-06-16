export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function MyBusinessProfile() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setDebug(`companyId from URL: ${companyId}`);

      let row = null;

      if (companyId) {
        const { data: r, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', Number(companyId))
          .single();

        if (error) {
          console.error('Supabase error:', error);
          setDebug(prev => prev + ` | Supabase error: ${error.message}`);
        } else {
          row = r;
        }
      }

      if (!row) {
        const { data: r } = await supabase.from('profiles').select('*').limit(1).single();
        row = r;
        setDebug(prev => prev + ' | Using fallback');
      }

      setData(row || { legal_name: 'No data found' });
      setLoading(false);
    };

    loadData();
  }, [companyId]);

  if (loading) return <div className="p-12">Loading company data...</div>;

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
        {data.legal_name}
      </h1>

      <p className="text-xl text-neutral-600 mt-2">
        Selected Company ID: {companyId || 'None'} • {debug}
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

      <button className="mt-8 bg-green-600 text-white px-10 py-3 rounded-2xl text-lg font-medium">
        Get Verified - R49 with Paystack
      </button>
    </div>
  );
}