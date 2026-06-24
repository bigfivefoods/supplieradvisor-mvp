'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle, Loader2, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

function TeamOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Create Supabase client (modern pattern)
  const supabase = createClient();

  // Validate invite token
  useEffect(() => {
    const validateToken = async () => {
      if (!inviteToken) {
        setError('No invitation token provided.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('business_users')
        .select('*')
        .eq('invite_token', inviteToken)
        .eq('status', 'invited')
        .single();

      if (error || !data) {
        setError('This invitation link is invalid or has already been claimed.');
        setLoading(false);
        return;
      }

      setInvitation(data);
      setFormData(prev => ({ ...prev, name: data.name || '' }));
      setLoading(false);
    };

    validateToken();
  }, [inviteToken, supabase]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!invitation || !inviteToken) return;

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSaving(true);

    try {
      // 1. Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.invited_email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name || invitation.name,
          },
        },
      });

      if (authError) throw authError;

      // 2. Update business_users record
      const { error: updateError } = await supabase
        .from('business_users')
        .update({
          user_id: authData.user?.id,
          status: 'active',
          name: formData.name || invitation.name,
          invite_token: null,
          joined_at: new Date().toISOString(),
        })
        .eq('invite_token', inviteToken);

      if (updateError) throw updateError;

      // 3. Sign them in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.invited_email,
        password: formData.password,
      });

      if (signInError) throw signInError;

      setSuccess(true);
      toast.success('Welcome! You have joined the team.');

      setTimeout(() => {
        router.push('/dashboard/my-business/team');
      }, 1500);

    } catch (err: any) {
      console.error('Team onboarding error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-6" />
          <h1 className="text-4xl font-black tracking-[-2px] mb-4">Welcome to the Team!</h1>
          <p className="text-xl text-neutral-600">Redirecting you to your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-6" />
          <h1 className="text-3xl font-bold tracking-tight mb-4">Unable to Proceed</h1>
          <p className="text-lg text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-6">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-[#00b4d8]/10 rounded-2xl">
              <Users className="w-10 h-10 text-[#00b4d8]" />
            </div>
          </div>
          <h1 className="text-5xl font-black tracking-[-3px] mb-3">Join Your Team</h1>
          <p className="text-xl text-neutral-600">You’ve been invited to join on SupplierAdvisor</p>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-10">
          <div className="mb-8">
            <div className="text-sm text-neutral-500 mb-1">You were invited as</div>
            <div className="text-2xl font-bold">{invitation?.role || 'Team Member'}</div>
            <div className="text-neutral-600 mt-1">{invitation?.invited_email}</div>
          </div>

          <form onSubmit={handleAcceptInvitation} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Email Address</label>
              <input
                type="email"
                value={invitation?.invited_email || ''}
                disabled
                className="w-full px-6 py-4 bg-neutral-100 border border-neutral-200 rounded-2xl text-lg text-neutral-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Create Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength={8}
                className="w-full px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
                placeholder="Create a secure password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="w-full px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
                placeholder="Confirm your password"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-[#00b4d8] hover:bg-[#0099b8] disabled:bg-neutral-400 text-white text-lg font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 mt-4"
            >
                {saving ? (
                  <> <Loader2 className="w-5 h-5 animate-spin" /> Creating Account... </>
                ) : (
                  'Accept Invitation & Create Account'
                )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-neutral-500 mt-6">
          By creating an account, you agree to join this company on SupplierAdvisor.
        </p>
      </div>
    </div>
  );
}

// ✅ This wrapper fixes the prerender error
export default function TeamOnboarding() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    }>
      <TeamOnboardingContent />
    </Suspense>
  );
}