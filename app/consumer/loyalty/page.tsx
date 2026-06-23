'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Star, Gift, Trophy, ArrowRight } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function ConsumerLoyalty() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [points, setPoints] = useState(1240);
  const [tier, setTier] = useState('Gold');

  useEffect(() => {
    const loadLoyalty = async () => {
      const { data } = await supabase
        .from('consumer_loyalty')
        .select('points, tier')
        .eq('user_id', cleanId)
        .single();
      if (data) {
        setPoints(data.points || 1240);
        setTier(data.tier || 'Gold');
      }
    };
    loadLoyalty();
  }, [cleanId]);

  return (
    <div className="pl-0 pr-12 py-12 bg-[#f8fafc]">
      <Breadcrumb />
      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Your Loyalty Dashboard</h1>
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-8">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm">Total Points</p>
              <p className="text-7xl font-black text-[#00b4d8]">{points}</p>
            </div>
            <Trophy className="text-amber-500" size={48} />
          </div>
          <div className="mt-8 text-emerald-600 font-medium">Gold Tier • 240 points to Platinum</div>
        </div>

        <div className="card p-8">
          <h3 className="font-bold mb-6 flex items-center gap-2"><Gift size={24} /> Available Rewards</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>R100 Voucher</span>
              <span className="text-emerald-600 font-bold">800 pts</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Free Coffee</span>
              <span className="text-emerald-600 font-bold">400 pts</span>
            </div>
          </div>
        </div>

        <div className="card p-8">
          <button className="btn-primary w-full py-6">Scan QR to Earn Points</button>
        </div>
      </div>
    </div>
  );
}