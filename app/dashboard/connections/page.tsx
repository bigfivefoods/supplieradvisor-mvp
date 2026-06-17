'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Users, Clock, CheckCircle, XCircle, Send, Plus } from 'lucide-react';
import Link from 'next/link';

type Connection = {
  id: number;
  requester_profile_id: number;
  requestee_profile_id: number;
  status: string;
  message: string | null;
  requested_at: string;
  approved_at: string | null;
  requester?: any;
  requestee?: any;
};

export default function ConnectionsPage() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [myProfileId, setMyProfileId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'network' | 'sent' | 'received'>('network');

  const [network, setNetwork] = useState<Connection[]>([]);
  const [sentRequests, setSentRequests] = useState<Connection[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  // Send Request Form State
  const [showSendForm, setShowSendForm] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Get current user's profile ID
  useEffect(() => {
    const getMyProfile = async () => {
      if (!cleanId) return;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', cleanId)
        .single();
      if (data) setMyProfileId(data.id);
    };
    getMyProfile();
  }, [cleanId]);

  const loadConnections = async () => {
    if (!myProfileId) return;
    setLoading(true);

    const { data: networkData } = await supabase
      .from('business_connections')
      .select(`*, requester:profiles!business_connections_requester_profile_id_fkey(id, legal_name, trading_name, email), requestee:profiles!business_connections_requestee_profile_id_fkey(id, legal_name, trading_name, email)`)
      .or(`requester_profile_id.eq.${myProfileId},requestee_profile_id.eq.${myProfileId}`)
      .eq('status', 'accepted');

    const { data: sentData } = await supabase
      .from('business_connections')
      .select(`*, requestee:profiles!business_connections_requestee_profile_id_fkey(id, legal_name, trading_name, email)`)
      .eq('requester_profile_id', myProfileId)
      .eq('status', 'pending');

    const { data: receivedData } = await supabase
      .from('business_connections')
      .select(`*, requester:profiles!business_connections_requester_profile_id_fkey(id, legal_name, trading_name, email)`)
      .eq('requestee_profile_id', myProfileId)
      .eq('status', 'pending');

    setNetwork(networkData || []);
    setSentRequests(sentData || []);
    setReceivedRequests(receivedData || []);
    setLoading(false);
  };

  useEffect(() => {
    if (myProfileId) loadConnections();
  }, [myProfileId]);

  // ==================== SEND CONNECTION REQUEST ====================
  const sendConnectionRequest = async () => {
    if (!myProfileId || !targetEmail) return;

    setSending(true);

    try {
      // Find the target business by email
      const { data: targetProfile, error: findError } = await supabase
        .from('profiles')
        .select('id, legal_name, trading_name')
        .eq('email', targetEmail.toLowerCase().trim())
        .single();

      if (findError || !targetProfile) {
        toast.error('No business found with that email');
        setSending(false);
        return;
      }

      if (targetProfile.id === myProfileId) {
        toast.error("You can't send a request to yourself");
        setSending(false);
        return;
      }

      // Check if a connection already exists
      const { data: existing } = await supabase
        .from('business_connections')
        .select('id, status')
        .or(`and(requester_profile_id.eq.${myProfileId},requestee_profile_id.eq.${targetProfile.id}),and(requester_profile_id.eq.${targetProfile.id},requestee_profile_id.eq.${myProfileId})`)
        .maybeSingle();

      if (existing) {
        toast.error(`Connection already exists (${existing.status})`);
        setSending(false);
        return;
      }

      // Create the connection request
      const { error: insertError } = await supabase.from('business_connections').insert({
        requester_profile_id: myProfileId,
        requestee_profile_id: targetProfile.id,
        status: 'pending',
        message: requestMessage || null,
        requested_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      toast.success(`Connection request sent to ${targetProfile.trading_name || targetProfile.legal_name}`);
      setShowSendForm(false);
      setTargetEmail('');
      setRequestMessage('');
      loadConnections();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const acceptRequest = async (connectionId: number) => {
    const { error } = await supabase
      .from('business_connections')
      .update({ status: 'accepted', approved_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (error) toast.error('Failed to accept');
    else {
      toast.success('Connection accepted');
      loadConnections();
    }
  };

  const declineRequest = async (connectionId: number) => {
    const { error } = await supabase
      .from('business_connections')
      .update({ status: 'declined' })
      .eq('id', connectionId);

    if (error) toast.error('Failed to decline');
    else {
      toast.success('Request declined');
      loadConnections();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-[#00b4d8] rounded-full"></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-black text-4xl tracking-tight">Connections</h1>
          <p className="text-neutral-600 mt-1">Manage your business relationships</p>
        </div>
        <button
          onClick={() => setShowSendForm(true)}
          className="btn-primary flex items-center gap-2 px-6 py-3"
        >
          <Plus className="w-4 h-4" /> Send Connection Request
        </button>
      </div>

      {/* Send Request Modal / Form */}
      {showSendForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md">
            <h2 className="font-semibold text-2xl mb-6">Send Connection Request</h2>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium">Business Email</label>
                <input
                  type="email"
                  className="input w-full mt-1"
                  placeholder="hello@company.com"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Message (Optional)</label>
                <textarea
                  className="input w-full h-24 mt-1"
                  placeholder="Hi, I'd like to connect with you on SupplierAdvisor..."
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowSendForm(false);
                  setTargetEmail('');
                  setRequestMessage('');
                }}
                className="flex-1 py-3 border border-neutral-300 rounded-2xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={sendConnectionRequest}
                disabled={sending || !targetEmail}
                className="flex-1 btn-primary py-3 disabled:opacity-60"
              >
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 mb-8">
        <button onClick={() => setActiveTab('network')} className={`px-6 py-3 font-medium flex items-center gap-2 ${activeTab === 'network' ? 'border-b-2 border-[#00b4d8] text-[#00b4d8]' : 'text-neutral-600'}`}>
          <Users className="w-4 h-4" /> My Network ({network.length})
        </button>
        <button onClick={() => setActiveTab('sent')} className={`px-6 py-3 font-medium flex items-center gap-2 ${activeTab === 'sent' ? 'border-b-2 border-[#00b4d8] text-[#00b4d8]' : 'text-neutral-600'}`}>
          <Clock className="w-4 h-4" /> Requests Sent ({sentRequests.length})
        </button>
        <button onClick={() => setActiveTab('received')} className={`px-6 py-3 font-medium flex items-center gap-2 ${activeTab === 'received' ? 'border-b-2 border-[#00b4d8] text-[#00b4d8]' : 'text-neutral-600'}`}>
          <Clock className="w-4 h-4" /> Requests Received ({receivedRequests.length})
        </button>
      </div>

      {/* Content Sections */}
      {activeTab === 'network' && (
        <div className="space-y-4">
          {network.length === 0 ? <p className="text-neutral-500">No connections yet.</p> : network.map((conn) => {
            const other = conn.requester_profile_id === myProfileId ? conn.requestee : conn.requester;
            return (
              <div key={conn.id} className="bg-white border border-neutral-200 rounded-3xl p-6 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-lg">{other?.trading_name || other?.legal_name}</div>
                  <div className="text-sm text-neutral-500">{other?.email}</div>
                </div>
                <div className="text-emerald-600 flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="w-5 h-5" /> Connected
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="space-y-4">
          {sentRequests.length === 0 ? <p className="text-neutral-500">No pending requests sent.</p> : sentRequests.map((req) => (
            <div key={req.id} className="bg-white border border-neutral-200 rounded-3xl p-6">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">{req.requestee?.trading_name || req.requestee?.legal_name}</div>
                  <div className="text-sm text-neutral-500">{req.requestee?.email}</div>
                  {req.message && <p className="mt-2 text-sm italic">"{req.message}"</p>}
                </div>
                <div className="text-amber-600 flex items-center gap-2 text-sm"><Clock className="w-4 h-4" /> Pending</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'received' && (
        <div className="space-y-4">
          {receivedRequests.length === 0 ? <p className="text-neutral-500">No pending requests received.</p> : receivedRequests.map((req) => (
            <div key={req.id} className="bg-white border border-neutral-200 rounded-3xl p-6">
              <div>
                <div className="font-semibold">{req.requester?.trading_name || req.requester?.legal_name}</div>
                <div className="text-sm text-neutral-500">{req.requester?.email}</div>
                {req.message && <p className="mt-2 text-sm italic">"{req.message}"</p>}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => acceptRequest(req.id)} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-2xl text-sm font-medium">Accept</button>
                <button onClick={() => declineRequest(req.id)} className="flex items-center gap-2 px-6 py-2 border border-neutral-300 rounded-2xl text-sm font-medium">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}