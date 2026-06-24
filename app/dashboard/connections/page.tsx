'use client';

import { useState, useEffect, useTransition } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createClient } from '@/utils/supabase/client';
import { getMyProfileId } from '@/app/actions/get-my-profile';
import { toast } from 'sonner';
import { ArrowLeft, Check, X, Clock, Users, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type Connection = {
  id: number;
  requester_profile_id: number;
  requestee_profile_id: number;
  status: 'pending' | 'accepted' | 'declined';
  message: string | null;
  requested_at: string;
  responded_at: string | null;
  requester: { id: number; trading_name: string | null; legal_name: string; email: string } | null;
  requestee: { id: number; trading_name: string | null; legal_name: string; email: string } | null;
};

type Tab = 'all' | 'sent' | 'received' | 'accepted';

export default function ConnectionsPage() {
  const supabase = createClient();
  const { user, ready } = usePrivy();
  const [myProfileId, setMyProfileId] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Get current user's profile ID via Server Action
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id || !ready) return;

      setLoadingProfile(true);
      setError('');

      try {
        const profileId = await getMyProfileId(user.id);

        if (!profileId) {
          setError('Could not find your profile. Please complete onboarding first.');
        } else {
          setMyProfileId(profileId);
        }
      } catch (err) {
        setError('Failed to load your profile.');
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [user?.id, ready]);

  // Load connections
  const loadConnections = async () => {
    if (!myProfileId) return;

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('business_connections')
        .select(`
          id,
          requester_profile_id,
          requestee_profile_id,
          status,
          message,
          requested_at,
          responded_at,
          requester:profiles!business_connections_requester_profile_id_fkey (id, trading_name, legal_name, email),
          requestee:profiles!business_connections_requestee_profile_id_fkey (id, trading_name, legal_name, email)
        `)
        .or(`requester_profile_id.eq.${myProfileId},requestee_profile_id.eq.${myProfileId}`)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      setConnections(data as any || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (myProfileId) {
      loadConnections();
    }
  }, [myProfileId, supabase]);

  // Filter connections
  const filteredConnections = connections.filter((conn) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'sent') return conn.requester_profile_id === myProfileId && conn.status === 'pending';
    if (activeTab === 'received') return conn.requestee_profile_id === myProfileId && conn.status === 'pending';
    if (activeTab === 'accepted') return conn.status === 'accepted';
    return true;
  });

  // Accept connection request
  const acceptRequest = async (connectionId: number) => {
    setProcessingId(connectionId);
    try {
      const { error } = await supabase
        .from('business_connections')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;

      toast.success('Connection accepted');
      loadConnections();
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept request');
    } finally {
      setProcessingId(null);
    }
  };

  // Decline connection request
  const declineRequest = async (connectionId: number) => {
    setProcessingId(connectionId);
    try {
      const { error } = await supabase
        .from('business_connections')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;

      toast.success('Request declined');
      loadConnections();
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline request');
    } finally {
      setProcessingId(null);
    }
  };

  // ==================== RENDER ====================

  if (loadingProfile || isPending) {
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
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/suppliers" className="text-neutral-500 hover:text-neutral-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-black text-4xl tracking-tight">Connections</h1>
          <p className="text-neutral-600">Manage your business network</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-neutral-200 pb-1">
        {[
          { key: 'all', label: 'All' },
          { key: 'sent', label: 'Sent' },
          { key: 'received', label: 'Received' },
          { key: 'accepted', label: 'Connected' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className={`px-6 py-2 rounded-2xl text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-[#00b4d8] text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-b-2 border-[#00b4d8] rounded-full"></div>
        </div>
      ) : filteredConnections.length === 0 ? (
        <div className="text-center py-16 bg-white border border-neutral-200 rounded-3xl">
          <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-neutral-500">No connections found in this category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredConnections.map((conn) => {
            const isSentByMe = conn.requester_profile_id === myProfileId;
            const otherParty = isSentByMe ? conn.requestee : conn.requester;
            const otherName = otherParty?.trading_name || otherParty?.legal_name || 'Unknown Business';

            return (
              <div key={conn.id} className="bg-white border border-neutral-200 rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg">{otherName}</div>
                  <div className="text-sm text-neutral-500">{otherParty?.email}</div>
                  {conn.message && (
                    <div className="mt-2 text-sm italic text-neutral-600">“{conn.message}”</div>
                  )}
                  <div className="text-xs text-neutral-400 mt-1">
                    {new Date(conn.requested_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {conn.status === 'pending' && !isSentByMe && (
                    <>
                      <button
                        onClick={() => acceptRequest(conn.id)}
                        disabled={processingId === conn.id}
                        className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-2xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check className="w-4 h-4" /> Accept
                      </button>
                      <button
                        onClick={() => declineRequest(conn.id)}
                        disabled={processingId === conn.id}
                        className="flex items-center gap-2 px-5 py-2 bg-red-500 text-white rounded-2xl text-sm font-medium hover:bg-red-600 disabled:opacity-60"
                      >
                        <X className="w-4 h-4" /> Decline
                      </button>
                    </>
                  )}

                  {conn.status === 'pending' && isSentByMe && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm font-medium px-4">
                      <Clock className="w-4 h-4" /> Pending
                    </div>
                  )}

                  {conn.status === 'accepted' && (
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium px-4">
                      <Check className="w-4 h-4" /> Connected
                    </div>
                  )}

                  {conn.status === 'declined' && (
                    <div className="text-sm text-neutral-500 px-4">Declined</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}