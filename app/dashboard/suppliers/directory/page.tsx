'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { ArrowLeft, Send, Users } from 'lucide-react';
import Link from 'next/link';

type Business = {
  id: number;
  legal_name: string;
  trading_name: string | null;
  email: string;
  city: string | null;
  country: string | null;
};

export default function BusinessDirectoryPage() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [myProfileId, setMyProfileId] = useState<number | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
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

  // Load all businesses
  const loadBusinesses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, legal_name, trading_name, email, city, country')
      .eq('relationship_type', 'business')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load businesses');
    } else {
      setBusinesses(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  // Filter businesses based on search
  const filteredBusinesses = businesses.filter(b =>
    b.legal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.trading_name && b.trading_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    b.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Open send request modal
  const openSendRequest = (business: Business) => {
    setSelectedBusiness(business);
    setRequestMessage('');
    setShowModal(true);
  };

  // Send connection request
  const sendConnectionRequest = async () => {
    if (!myProfileId || !selectedBusiness) return;

    setSending(true);

    try {
      // Check if connection already exists
      const { data: existing } = await supabase
        .from('business_connections')
        .select('id, status')
        .or(`and(requester_profile_id.eq.${myProfileId},requestee_profile_id.eq.${selectedBusiness.id}),and(requester_profile_id.eq.${selectedBusiness.id},requestee_profile_id.eq.${myProfileId})`)
        .maybeSingle();

      if (existing) {
        toast.error(`Connection already exists (${existing.status})`);
        setSending(false);
        return;
      }

      // Create request
      const { error } = await supabase.from('business_connections').insert({
        requester_profile_id: myProfileId,
        requestee_profile_id: selectedBusiness.id,
        status: 'pending',
        message: requestMessage || null,
        requested_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(`Connection request sent to ${selectedBusiness.trading_name || selectedBusiness.legal_name}`);
      setShowModal(false);
      setSelectedBusiness(null);
      setRequestMessage('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-b-2 border-[#00b4d8] rounded-full"></div>
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
          <p className="text-neutral-600">Browse businesses and send connection requests</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          className="input w-full max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Business List */}
      <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden">
        {filteredBusinesses.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">No businesses found.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredBusinesses.map((business) => (
              <div key={business.id} className="p-6 flex items-center justify-between hover:bg-neutral-50">
                <div>
                  <div className="font-semibold text-lg">
                    {business.trading_name || business.legal_name}
                  </div>
                  <div className="text-sm text-neutral-500">{business.email}</div>
                  {(business.city || business.country) && (
                    <div className="text-xs text-neutral-400 mt-1">
                      {[business.city, business.country].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => openSendRequest(business)}
                  className="flex items-center gap-2 px-5 py-2 bg-[#00b4d8] text-white rounded-2xl text-sm font-medium hover:bg-[#0096b8]"
                >
                  <Send className="w-4 h-4" /> Send Connection Request
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Request Modal */}
      {showModal && selectedBusiness && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md">
            <h2 className="font-semibold text-2xl mb-2">Send Connection Request</h2>
            <p className="text-neutral-600 mb-6">
              to <span className="font-medium">{selectedBusiness.trading_name || selectedBusiness.legal_name}</span>
            </p>

            <div>
              <label className="text-sm font-medium">Message (Optional)</label>
              <textarea
                className="input w-full h-28 mt-1"
                placeholder="Hi, I'd like to connect with you on SupplierAdvisor..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedBusiness(null);
                  setRequestMessage('');
                }}
                className="flex-1 py-3 border border-neutral-300 rounded-2xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={sendConnectionRequest}
                disabled={sending}
                className="flex-1 btn-primary py-3 disabled:opacity-60"
              >
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}