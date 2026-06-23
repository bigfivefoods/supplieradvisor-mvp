'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Building2 } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function NetworkPage() {
  const { user } = usePrivy();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const loadMemberships = async () => {
    if (!user?.id) {
      setDebugInfo('No user.id from Privy');
      return;
    }

    console.log('%c[Network] Privy user.id =', 'color: blue', user.id);

    try {
      const { data, error } = await supabase
        .from('business_users')
        .select('id, profile_id, role, status, user_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      console.log('%c[Network] Query result:', 'color: green', { data, error });

      if (error) {
        setDebugInfo('Supabase error: ' + error.message);
        return;
      }

      if (!data || data.length === 0) {
        setDebugInfo(`Query returned 0 rows for user_id: ${user.id}`);
        setMemberships([]);
        return;
      }

      setMemberships(data);
      setDebugInfo(`Success! Found ${data.length} active companies`);

    } catch (err: any) {
      console.error(err);
      setDebugInfo('Unexpected error: ' + err.message);
    }
  };

  useEffect(() => {
    loadMemberships();
  }, [user?.id]);

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12 px-8 max-w-5xl mx-auto">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-8">Network (Debug Mode)</h1>

        <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
          <h2 className="font-bold mb-4">Debug Info</h2>
          <pre className="bg-neutral-100 p-4 rounded-xl text-sm overflow-auto">{debugInfo}</pre>
          <p className="text-xs text-neutral-500 mt-2">Check browser console (F12) for more details</p>
        </div>

        {memberships.length > 0 ? (
          <div className="bg-white rounded-3xl border p-8">
            <h3 className="font-bold mb-4">Active Companies Found:</h3>
            <ul className="space-y-2">
              {memberships.map((m, i) => (
                <li key={i} className="font-mono text-sm">
                  profile_id: {m.profile_id} | role: {m.role} | status: {m.status}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Active Company</h2>
            <p className="text-neutral-600">Still returning zero results. See debug info above.</p>
          </div>
        )}
      </div>
    </div>
  );
}