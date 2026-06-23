'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { Users, Building2, Send, CheckCircle } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

interface Membership {
  profile_id: number;
  role: string;
  profile: {
    trading_name: string | null;
    legal_name: string | null;
  };
}

interface Connection {
  id: number;
  requester_profile_id: number;
  target_profile_id: number;
  status: string;
  created_at: string;
  onchain_tx: string | null;
  requester_profile?: { trading_name: string | null; legal_name: string | null };
  target_profile?: { trading_name: string | null; legal_name: string | null };
}

export default function NetworkPage() {
  const { user, signMessage } = usePrivy();

  const [loading, setLoading] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<number | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState('');
  const [showSwitcher, setShowSwitcher] = useState(false);

  const [connections, setConnections] = useState<Connection[]>([]);
  const [targetProfileId, setTargetProfileId] = useState('');
  const [message, setMessage] = useState('');

  // Load companies
  const loadMemberships = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('business_users')
      .select(`
        profile_id,
        role,
        profiles:profile_id (trading_name, legal_name)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!data || data.length === 0) {
      setMemberships([]);
      return;
    }

    const formatted = data.map((m: any) => ({
      profile_id: m.profile_id,
      role: m.role,
      profile: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
    }));

    setMemberships(formatted);

    const storageKey = `supplieradvisor_last_company_${user.id}`;
    const savedId = localStorage.getItem(storageKey);
    const savedProfileId = savedId ? parseInt(savedId) : null;

    const defaultMembership = savedProfileId && formatted.some(m => m.profile_id === savedProfileId)
      ? formatted.find(m => m.profile_id === savedProfileId)!
      : formatted[0];

    setCurrentProfileId(defaultMembership.profile_id);
    setCurrentProfileName(
      defaultMembership.profile?.trading_name || 
      defaultMembership.profile?.legal_name || 
      `Company ${defaultMembership.profile_id}`
    );
  };

  useEffect(() => {
    loadMemberships();
  }, [user?.id]);

  const switchCompany = (membership: Membership) => {
    setCurrentProfileId(membership.profile_id);
    setCurrentProfileName(
      membership.profile?.trading_name || 
      membership.profile?.legal_name || 
      `Company ${membership.profile_id}`
    );
    setShowSwitcher(false);

    if (user?.id) {
      localStorage.setItem(`supplieradvisor_last_company_${user.id}`, membership.profile_id.toString());
    }
  };

  const fetchConnections = async () => {
    if (!currentProfileId) return;

    const { data } = await supabase
      .from('business_connections')
      .select(`
        *,
        requester_profile:requester_profile_id (trading_name, legal_name),
        target_profile:target_profile_id (trading_name, legal_name)
      `)
      .or(`requester_profile_id.eq.${currentProfileId},target_profile_id.eq.${currentProfileId}`)
      .order('created_at', { ascending: false });

    if (data) setConnections(data as any);
  };

  useEffect(() => {
    if (currentProfileId) fetchConnections();
  }, [currentProfileId]);

  const handleSendConnection = async () => {
    if (!currentProfileId || !targetProfileId) {
      alert('Please enter a target Profile ID');
      return;
    }

    setLoading(true);
    try {
      const sigMessage = `SupplierAdvisor Connection Request\nFrom: ${currentProfileName} (ID: ${currentProfileId})\nTo: Profile ${targetProfileId}\nTime: ${new Date().toISOString()}`;
      const signature = await signMessage({ message: sigMessage });

      const { error } = await supabase.from('business_connections').insert({
        requester_profile_id: currentProfileId,
        target_profile_id: parseInt(targetProfileId),
        status: 'pending',
        onchain_tx: signature,
      });

      if (error) throw error;

      alert('✅ Connection request sent with onchain signature!');
      setTargetProfileId('');
      setMessage('');
      fetchConnections();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12 px-8 max-w-5xl mx-auto">
        <Breadcrumb />

        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Network</h1>
            <p className="text-xl text-neutral-600 mt-1">Onchain Business Connections</p>
          </div>

          {/* Company Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="flex items-center gap-3 bg-white border border-neutral-200 rounded-2xl px-4 py-2 hover:border-neutral-300"
            >
              <Building2 className="w-4 h-4 text-[#00b4d8]" />
              <span className="font-semibold text-sm">{currentProfileName}</span>
            </button>

            {showSwitcher && memberships.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 py-2">
                {memberships.map((m) => (
                  <button
                    key={m.profile_id}
                    onClick={() => switchCompany(m)}
                    className={`w-full text-left px-4 py-3 hover:bg-neutral-50 flex justify-between ${m.profile_id === currentProfileId ? 'bg-[#00b4d8]/5' : ''}`}
                  >
                    <span>{m.profile?.trading_name || m.profile?.legal_name || `Company ${m.profile_id}`}</span>
                    <span className="text-xs text-neutral-500">{m.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {memberships.length === 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center max-w-md mx-auto">
            <Building2 className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Active Company</h2>
            <p className="text-neutral-600 mb-6">You need to be part of an active company to use the Network.</p>
            <a href="/dashboard/select-company" className="inline-block px-8 py-3 bg-[#00b4d8] text-white rounded-2xl font-semibold">
              Go to Company Selector
            </a>
          </div>
        ) : (
          <>
            {/* Send Connection Request */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-10 mb-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-[#00b4d8]/10 rounded-2xl">
                  <Send className="w-6 h-6 text-[#00b4d8]" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">Send Connection Request</h2>
                  <p className="text-neutral-600">Signed onchain • Verifiable</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Target Company Profile ID</label>
                  <input
                    type="number"
                    value={targetProfileId}
                    onChange={(e) => setTargetProfileId(e.target.value)}
                    className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8] outline-none"
                    placeholder="e.g. 102"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Message (Optional)</label>
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:border-[#00b4d8] outline-none"
                    placeholder="Would love to connect..."
                  />
                </div>
              </div>

              <button
                onClick={handleSendConnection}
                disabled={loading || !targetProfileId}
                className="mt-8 w-full py-4 bg-[#00b4d8] hover:bg-[#0099b8] disabled:bg-neutral-300 text-white text-lg font-semibold rounded-2xl flex items-center justify-center gap-3 transition-colors"
              >
                {loading ? 'Signing onchain...' : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Onchain Connection Request
                  </>
                )}
              </button>
            </div>

            {/* My Connections */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold">My Connections</h2>
                <button onClick={fetchConnections} className="text-[#00b4d8] text-sm hover:underline">Refresh</button>
              </div>

              {connections.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">No connections yet. Send your first request above.</div>
              ) : (
                <div className="space-y-4">
                  {connections.map((conn) => {
                    const isOutgoing = conn.requester_profile_id === currentProfileId;
                    const otherProfile = isOutgoing ? conn.target_profile : conn.requester_profile;
                    const otherName = otherProfile?.trading_name || otherProfile?.legal_name || `Profile ${isOutgoing ? conn.target_profile_id : conn.requester_profile_id}`;

                    return (
                      <div key={conn.id} className="border border-neutral-200 rounded-2xl p-6 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-neutral-100 rounded-2xl">
                            <Users className="w-6 h-6 text-neutral-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg">{otherName}</div>
                            <div className="text-sm text-neutral-500">
                              {isOutgoing ? 'Outgoing' : 'Incoming'} • {new Date(conn.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {conn.onchain_tx && <span className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Onchain</span>}
                          <span className={`px-4 py-1.5 rounded-2xl text-sm font-medium capitalize ${
                            conn.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                            conn.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'
                          }`}>{conn.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
