'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';

export default function SelectCompanyDebug() {
  const { user: privyUser, ready } = usePrivy();
  const [debug, setDebug] = useState<any>({});

  useEffect(() => {
    const runDebug = async () => {
      if (!ready) return;

      const info: any = {
        privyId: privyUser?.id,
        privyEmail: privyUser?.email,
        timestamp: new Date().toISOString(),
      };

      // Try business_users query with the exact ID we inserted
      const { data: buData, error: buError } = await supabase
        .from('business_users')
        .select('user_id, profile_id, role, status, profiles(id, trading_name, email, supplier_status)')
        .eq('user_id', 'did:cmmkfe47g012f0djolmvhx6x3')
        .eq('status', 'active');

      info.businessUsersQuery = {
        data: buData,
        error: buError ? buError.message : null,
        count: buData?.length || 0,
      };

      // Try direct profiles query by email
      if (privyUser?.email) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, trading_name, email, supplier_status')
          .ilike('email', String(privyUser.email));

        info.profilesByEmail = {
          emailUsed: privyUser.email,
          data: profileData,
          error: profileError ? profileError.message : null,
          count: profileData?.length || 0,
        };
      }

      // Try getting ALL active profiles (temporary debug only)
      const { data: allActive } = await supabase
        .from('profiles')
        .select('id, trading_name, email, supplier_status')
        .eq('supplier_status', 'active')
        .limit(20);

      info.allActiveProfilesSample = allActive;

      console.log('=== DEBUG OUTPUT ===', info);
      setDebug(info);
    };

    runDebug();
  }, [privyUser, ready]);

  return (
    <div className="min-h-screen bg-white p-8 font-mono text-sm">
      <h1 className="text-2xl font-bold mb-6 text-red-600">DEBUG: Select Company</h1>
      
      <pre className="bg-neutral-950 text-green-400 p-6 rounded-2xl overflow-auto text-xs">
        {JSON.stringify(debug, null, 2)}
      </pre>

      <div className="mt-6 text-neutral-600">
        Open browser console (F12) and look for <strong>"=== DEBUG OUTPUT ==="</strong><br />
        Copy and paste the full output here.
      </div>
    </div>
  );
}