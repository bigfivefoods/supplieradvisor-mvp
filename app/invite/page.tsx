'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, login, ready } = usePrivy();
  const supabase = createClient();

  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Fetch invitation details
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('invitations')
        .select('*, profiles:profile_id (legal_name, trading_name)')
        .eq('token', token)
        .single();

      if (error || !data) {
        toast.error('Invalid or expired invitation link');
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        toast.error('This invitation has expired');
        setLoading(false);
        return;
      }

      if (data.status !== 'pending') {
        toast.error('This invitation has already been used');
        setLoading(false);
        return;
      }

      setInvitation(data);
      setLoading(false);
    };

    fetchInvitation();
  }, [token, supabase]);

  // Accept invitation after login
  const acceptInvitation = async () => {
    if (!invitation || !user) return;

    setProcessing(true);

    try {
      const cleanId = user.id.replace('privy:', '');

      // 1. Add user to business_users
      const { error: linkError } = await supabase
        .from('business_users')
        .insert({
          user_id: cleanId,
          profile_id: invitation.profile_id,
          role: invitation.role || 'member',
          status: 'active',
          joined_at: new Date().toISOString(),
        });

      if (linkError) {
        console.error('Error adding to business_users:', linkError);
        toast.error('Failed to join the company');
        setProcessing(false);
        return;
      }

      // 2. Update invitation status
      await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('token', token);

      toast.success(`Welcome to ${invitation.profiles?.legal_name || 'the company'}!`);
      
      // 3. Redirect to select company
      router.push('/dashboard/select-company');

    } catch (err) {
      console.error('Error accepting invitation:', err);
      toast.error('Something went wrong');
    } finally {
      setProcessing(false);
    }
  };

  // Trigger login if user is not logged in
  const handleJoin = () => {
    if (!user) {
      login();
    } else {
      acceptInvitation();
    }
  };

  // Auto-accept if user logs in after clicking the link
  useEffect(() => {
    if (ready && user && invitation) {
      // Small delay to let Privy fully initialize
      const timer = setTimeout(() => {
        acceptInvitation();
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [ready, user, invitation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00b4d8] mx-auto mb-4"></div>
          <p>Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-4">Invalid Invitation</h1>
          <p className="text-neutral-600 mb-6">
            This invitation link is invalid or has expired.
          </p>
          <button 
            onClick={() => router.push('/')}
            className="btn-primary px-8 py-3"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8fafc]">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-sm border border-neutral-100 text-center">
        <h1 className="text-3xl font-bold mb-2">You've been invited!</h1>
        
        <p className="text-xl text-neutral-700 mb-8">
          Join <span className="font-semibold">{invitation.profiles?.legal_name}</span>
        </p>

        <div className="bg-neutral-50 rounded-2xl p-6 mb-8 text-left">
          <div className="text-sm text-neutral-500 mb-1">Role</div>
          <div className="font-medium">{invitation.role || 'Team Member'}</div>
          
          <div className="text-sm text-neutral-500 mt-4 mb-1">Invited by</div>
          <div className="font-medium">{invitation.inviter_name || 'The team'}</div>
        </div>

        <button
          onClick={handleJoin}
          disabled={processing}
          className="btn-primary w-full py-4 text-lg disabled:opacity-70"
        >
          {processing ? 'Joining...' : user ? 'Accept Invitation' : 'Log in & Accept Invitation'}
        </button>

        <p className="text-xs text-neutral-500 mt-6">
          By accepting, you agree to join this company on SupplierAdvisor.
        </p>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading invitation...</p>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}