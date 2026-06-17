'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { ArrowLeft, Send, Users, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type Business = {
  id: number;
  legal_name: string;
  trading_name: string | null;
  email: string;
  city: string | null;
  country: string | null;
};

type ConnectionStatus = 'connected' | 'request_sent' | 'request_received' | null;

export default function BusinessDirectoryPage() {
  const { user, ready } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [myProfileId, setMyProfileId] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<number, ConnectionStatus>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Get current user's profile ID
  useEffect(() => {
    const getMyProfile = async () => {
      if (!cleanId || !ready) return;

      setLoadingProfile(true);
      setError('');

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', cleanId)
          .single();

        if (error || !data) {
          setError('Could not load your profile. Please try again.');
        } else {
          setMyProfileId(data.id);
        }
      } catch (err) {
        setError('Failed to load profile.');
      } finally {
        setLoadingProfile(false);
      }
    };

    getMyProfile();
  }, [cleanId, ready]);

  // Load businesses + connection statuses
  const loadData = async () => {
    if (!myProfileId) return;

    setLoadingData(true);
    setError('');

    try {
      // Load businesses
      const { data: businessesData, error: bizError } = await supabase
        .from('profiles')
        .select('id, legal_name, trading_name, email, city, country')
        .eq('relationship_type', 'business')
        .order('created_at', { ascending: false });

      if (bizError) throw bizError;

      // Load connections
      const { data: connectionsData } = await supabase
        .from('business_connections')
        .select('requester_profile_id, requestee_profile_id, status')
        .or(`requester_profile_id.eq.${myProfileId},requestee_profile_id.eq.${myProfileId}`);

      // Build status map
      const statusMap: Record<number, ConnectionStatus> = {};
      connectionsData?.forEach((conn) => {
        const otherId = conn.requester_profile_id === myProfileId 
          ? conn.requestee_profile_id 
          : conn.requester_profile_id;

        if (conn.status === 'accepted') {
          statusMap[otherId] = 'connected';
        } else if (conn.status === 'pending') {
          statusMap[otherId] = conn.requester_profile_id === myProfileId 
            ? 'request_sent' 
            : 'request_received';
        }
      });

      setBusinesses(businessesData || []);
      setConnectionStatuses(statusMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load businesses');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (myProfileId) {
      loadData();
    }
  }, [myProfileId]);

  const filteredBusinesses = businesses.filter(b =>
    b.legal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.trading_name && b.trading_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    b.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openSendRequest = (business: Business) => {
    setSelectedBusiness(business);
    setRequestMessage('');
    setShowModal(true);
  };

  const sendConnectionRequest = async () => {
    if (!myProfileId || !selectedBusiness) return;

    setSending(true);
    try {
      const { error } = await supabase.from('business_connections').insert({
        requester_profile_id: myProfileId,
        requestee_profile_id: selectedBusiness.id,
        status: 'pending',
        message: requestMessage || null,
        requested_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(`Request sent to ${selectedBusiness.trading_name || selectedBusiness.legal_name}`);
      setShowModal(false);
      setSelectedBusiness(null);
      setRequestMessage('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (businessId: number) => {
    const status = connectionStatuses[businessId];
    if (status === 'connected') {
      return <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" /> Connected</div>;
    }
    if (status === 'request_sent') {
      return <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium"><Clock className="w-3.5 h-3.5" /> Request Sent</div>;
    }
    if (status === 'request_received') {
      return <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"><Clock className="w-3.5 h-3.5" /> Request Received</div>;
    }
    return null;
  };

  // ==================== RENDER ====================

  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-b-2 border-[#00b4d8] rounded-full mb-4"></div>
        <p className="text-neutral-500">Loading your profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="font-semibold text-xl mb-2">Something went wrong</h2>
        <p className="text-neutral-600 mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary px-8">Try Again</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/suppliers" className="text-neutral-500 hover:text-neutral-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-black text-4xl tracking-tight">Business Directory</h1>
          <p className="text-neutral-600">Browse businesses and manage connections</p>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          className="input w-full max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loadingData ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-b-2 border-[#00b4d8] rounded-full"></div>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden">
          {filteredBusinesses.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">No businesses found.</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {filteredBusinesses.map((business) => {
                const status = connectionStatuses[business.id];
                const canSendRequest = !status;

                return (
                  <div key={business.id} className="p-6 flex items-center justify-between hover:bg-neutral-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-lg">{business.trading_name || business.legal_name}</div>
                        {getStatusBadge(business.id)}
                      </div>
                      <div className="text-sm text-neutral-500 mt-0.5">{business.email}</div>
                      {(business.city || business.country) && (
                        <div className="text-xs text-neutral-400 mt-1">
                          {[business.city, business.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>

                    <div>
                      {canSendRequest ? (
                        <button onClick={() => openSendRequest(business)} className="flex items-center gap-2 px-5 py-2 bg-[#00b4d8] text-white rounded-2xl text-sm font-medium hover:bg-[#0096b8]">
                          <Send className="w-4 h-4" /> Send Connection Request
                        </button>
                      ) : status === 'connected' ? (
                        <div className="text-emerald-600 text-sm font-medium px-4">Connected</div>
                      ) : (
                        <div className="text-amber-600 text-sm font-medium px-4">Pending</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Send Request Modal */}
      {showModal && selectedBusiness && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md">
            <h2 className="font-semibold text-2xl mb-2">Send Connection Request</h2>
            <p className="text-neutral-600 mb-6">to <span className="font-medium">{selectedBusiness.trading_name || selectedBusiness.legal_name}</span></p>

            <div>
              <label className="text-sm font-medium">Message (Optional)</label>
              <textarea className="input w-full h-28 mt-1" placeholder="Hi, I'd like to connect..." value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} />
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => { setShowModal(false); setSelectedBusiness(null); }} className="flex-1 py-3 border border-neutral-300 rounded-2xl font-medium">Cancel</button>
              <button onClick={sendConnectionRequest} disabled={sending} className="flex-1 btn-primary py-3 disabled:opacity-60">{sending ? 'Sending...' : 'Send Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}