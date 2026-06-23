'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { ToggleLeft, ToggleRight, Gift, Star } from 'lucide-react';
import { toast } from 'sonner';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function LoyaltyHub() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [enabled, setEnabled] = useState(false);

  const toggleLoyalty = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);

    const { error } = await supabase
      .from('profiles')
      .update({ loyalty_enabled: newEnabled })
      .eq('id', cleanId);

    if (error) {
      toast.error('Failed to update loyalty setting');
      setEnabled(!newEnabled); // revert UI
      return;
    }

    toast.success(
      newEnabled ? 'Loyalty program enabled!' : 'Loyalty program disabled'
    );
  };

  return (
    <div className="pl-0 pr-12 py-12 bg-[#f8fafc]">
      <Breadcrumb />
      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">
        Loyalty Program
      </h1>
      <div className="max-w-4xl mx-auto">
        <div className="card p-12">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold">Enable Loyalty for Big Five Foods</h2>
              <p className="text-slate-600 mt-2">
                Reward customers & partners with points on every purchase
              </p>
            </div>
            <button 
              onClick={toggleLoyalty} 
              className="flex items-center gap-3 text-2xl font-medium"
            >
              {enabled ? (
                <ToggleRight size={48} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={48} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}