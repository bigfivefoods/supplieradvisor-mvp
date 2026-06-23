'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Building2, ChevronDown, Check } from 'lucide-react';

interface Membership {
  profile_id: number;
  role: string;
  status: string;
  profile: {
    id: number;
    trading_name: string;
    legal_name: string | null;
  };
}

export default function NetworkPage() {
  const { user, signMessage } = usePrivy();

  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<number | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState('');
  const [showSwitcher, setShowSwitcher] = useState(false);

  const [targetProfileId, setTargetProfileId] = useState('');
  const [connectMessage, setConnectMessage] = useState(
    "Let's collaborate on African food security and build the Kingdom together!"
  );

  // Load memberships + restore last selected company from localStorage
  const loadMemberships = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('business_users')
      .select(`
        profile_id,
        role,
        status,
        profiles:profile_id (
          id,
          trading_name,
          legal_name
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (error || !data || data.length === 0) {
      setMemberships([]);
      setCurrentProfileId(null);
      setLoading(false);
      return;
    }

    const formatted: Membership[] = data.map((m: any) => ({
      profile_id: m.profile_id,
      role: m.role,
      status: m.status,
      profile: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
    }));

    setMemberships(formatted);

    // === PERSISTENCE LOGIC ===
    const storageKey = `supplieradvisor_last_company_${user.id}`;
    const savedId = localStorage.getItem(storageKey);
    const savedProfileId = savedId ? parseInt(savedId, 10) : null;

    // Use saved company if still valid, otherwise fall back to first
    const defaultMembership =
      savedProfileId && formatted.some((m) => m.profile_id === savedProfileId)
        ? formatted.find((m) => m.profile_id === savedProfileId)!
        : formatted[0];

    setCurrentProfileId(defaultMembership.profile_id);
    setCurrentProfileName(
      defaultMembership.profile?.trading_name ||
        defaultMembership.profile?.legal_name ||
        `Profile ${defaultMembership.profile_id}`
    );

    setLoading(false);
  };

  useEffect(() => {
    loadMemberships();
  }, [user?.id]);

  const fetchConnections = async (profileId: number) => {
    const { data, error } = await supabase
      .from('business_connections')
      .select('*')
      .or(`requester_profile_id.eq.${profileId},requestee_profile_id.eq.${profileId}`)
      .order('requested_at', { ascending: false });

    if (!error) setConnections(data || []);
  };

  useEffect(() => {
    if (currentProfileId) {
      fetchConnections(currentProfileId);
    }
  }, [currentProfileId]);

  const switchCompany = (membership: Membership) => {
    const newId = membership.profile_id;
    const newName =
      membership.profile?.trading_name ||
      membership.profile?.legal_name ||
      `Profile ${newId}`;

    setCurrentProfileId(newId);
    setCurrentProfileName(newName);
    setShowSwitcher(false);

    // === SAVE TO LOCALSTORAGE ===
    if (user?.id) {
      localStorage.setItem(`supplieradvisor_last_company_${user.id}`, newId.toString());
    }
  };

  const handleConnect = async () => {
    if (!currentProfileId) return;

    if (!targetProfileId) {
      alert('Please enter a target Profile ID');
      return;
    }

    setLoading(true);
    try {
      const sigMessage = `SupplierAdvisor Network Connection Request\nFrom: ${currentProfileName} (ID: ${currentProfileId})\nTo Profile: ${targetProfileId}\nTime: ${new Date().toISOString()}`;

      const signature = await signMessage({ message: sigMessage });

      const { error } = await supabase.from('business_connections').insert({
        requester_profile_id: currentProfileId,
        requestee_profile_id: parseInt(targetProfileId, 10),
        status: 'pending',
        message: connectMessage,
        onchain_tx: signature,
      });

      if (error) throw error;

      alert('✅ Connection request sent with onchain signature!');
      setTargetProfileId('');
      fetchConnections(currentProfileId);
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + (err.message || 'Failed to send connection'));
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER ====================

  if (loading && memberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-neutral-600">Loading your companies...</p>
        </div>
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-3xl border border-neutral-200 p-10">
          <Building2 className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Active Company</h2>
          <p className="text-neutral-600 mb-6">
            You need to be part of an active company to use the Network.
          </p>
          <a href="/dashboard/select-company" className="inline-block px-8 py-3 bg-[#00b4d8] text-white rounded-2xl font-semibold">
            Go to Company Selector
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#00b4d8]/10 rounded-2xl">
              <Users className="w-8 h-8 text-[#00b4d8]" />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-[-3px]">Network</h1>
              <p className="text-xl text-neutral-600">Connect with other companies — onchain</p>
            </div>
          </div>

          {/* Company Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="flex items-center gap-3 bg-white border border-neutral-200 hover:border-neutral-300 rounded-2xl px-4 py-2 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#00b4d8]" />
                <div className="text-left">
                  <div className="text-[10px] text-neutral-500 -mb-0.5">Current company</div>
                  <div className="font-semibold text-sm leading-none">{currentProfileName}</div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
            </button>

            {showSwitcher && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 py-2">
                {memberships.map((m) => {
                  const isActive = m.profile_id === currentProfileId;
                  const name = m.profile?.trading_name || m.profile?.legal_name || `Profile ${m.profile_id}`;

                  return (
                    <button
                      key={m.profile_id}
                      onClick={() => switchCompany(m)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors ${
                        isActive ? 'bg-[#00b4d8]/5' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-neutral-500 capitalize">{m.role}</div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-[#00b4d8]" />}
                    </button>
                  );
                })}
                <div className="border-t my-1" />
                <a href="/dashboard/select-company" className="block px-4 py-2 text-sm text-[#00b4d8] hover:bg-neutral-50">
                  + Manage companies
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Connect form */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6 text-[#00b4d8]" /> Send Connection Request
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Target Profile ID</label>
              <input
                type="number"
                value={targetProfileId}
                onChange={(e) => setTargetProfileId(e.target.value)}
                className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8] outline-none"
                placeholder="e.g. 42"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Message</label>
              <textarea
                value={connectMessage}
                onChange={(e) => setConnectMessage(e.target.value)}
                className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8] outline-none min-h-[100px]"
              />
            </div>

            <button
              onClick={handleConnect}
              disabled={loading || !targetProfileId}
              className="w-full py-4 bg-[#00b4d8] hover:bg-[#0099b8] disabled:bg-neutral-300 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? 'Signing & Sending...' : '🔗 Send Connection + Onchain Signature'}
            </button>
          </div>
        </div>

        {/* Connections */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Your Connections</h2>
            <button
              onClick={() => currentProfileId && fetchConnections(currentProfileId)}
              className="text-sm text-[#00b4d8] hover:underline"
            >
              Refresh
            </button>
          </div>

          {connections.length === 0 ? (
            <div className="text-center py-10 text-neutral-500">
              No connections yet for this company.
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((c) => (
                <div key={c.id} className="border rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {c.requester_profile_id === currentProfileId
                        ? `You → Profile ${c.requestee_profile_id}`
                        : `Profile ${c.requester_profile_id} → You`}
                    </div>
                    <div className="text-sm text-neutral-500">Status: {c.status}</div>
                  </div>
                  <div className="text-xs text-neutral-400 text-right">
                    {c.onchain_tx ? '✓ Onchain signed' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}