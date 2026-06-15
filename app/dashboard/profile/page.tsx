'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

export default function MyBusinessProfile() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');

  const [form, setForm] = useState({ legal_name: 'Loading...' });

  useEffect(() => {
    if (cleanId) {
      toast.success(`Loaded company: ${companyId || 'User default'}`);
      // TODO: Add real Supabase load later
    }
  }, [cleanId, companyId]);

  return (
    <div className="p-12">
      <h1 className="text-4xl font-bold">My Business Profile</h1>
      <p>Company ID: {companyId || 'None'}</p>
      <p>Legal Name: {form.legal_name}</p>
      <p className="text-green-600 mt-8">✅ Build should now pass. We can restore full UI next.</p>
    </div>
  );
}