'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface InvitedProfile {
  id: string;
  trading_name: string;
  legal_name: string | null;
  email: string;
  contact_name: string | null;
  contact_phone: string | null;
}

export default function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [mode, setMode] = useState<'loading' | 'claim' | 'normal' | 'success'>('loading');
  const [invitedProfile, setInvitedProfile] = useState<InvitedProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    contact_name: '',
    contact_phone: '',
    password: '',
    confirmPassword: '',
  });

  // ==================== VALIDATE INVITE TOKEN ====================
  useEffect(() => {
    const validateInvite = async () => {
      if (!inviteToken) {
        setMode('normal');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, email, contact_name, contact_phone')
        .eq('invite_token', inviteToken)
        .eq('supplier_status', 'invited')
        .single();

      if (error || !data) {
        setError('This invitation link is invalid or has already been claimed.');
        setMode('normal');
        return;
      }

      setInvitedProfile(data as InvitedProfile);
      setFormData(prev => ({
        ...prev,
        contact_name: data.contact_name || '',
        contact_phone: data.contact_phone || '',
      }));
      setMode('claim');
    };

    validateInvite();
  }, [inviteToken]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ==================== CLAIM + CREATE ACCOUNT (NO LOGIN REQUIRED) ====================
  const handleClaimProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!invitedProfile || !inviteToken) return;

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSaving(true);

    try {
      // 1. Create new Supabase Auth user (this is the main intended path)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitedProfile.email,
        password: formData.password,
        options: {
          data: { trading_name: invitedProfile.trading_name },
        },
      });

      if (authError) throw authError;

      // 2. Update the invited profile to active
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          supplier_status: 'active',
          claimed_at: new Date().toISOString(),
          contact_name: formData.contact_name,
          contact_phone: formData.contact_phone,
          invite_token: null,
        })
        .eq('invite_token', inviteToken);

      if (updateError) throw updateError;

      // 3. Create ownership record in business_users (with better error handling)
      if (authData.user?.id) {
        const { error: ownershipError } = await supabase
          .from('business_users')
          .insert({
            user_id: authData.user.id,
            profile_id: invitedProfile.id,
            role: 'owner',
            status: 'active',
            joined_at: new Date().toISOString(),
          });

        if (ownershipError) {
          console.error('Failed to create business_users record:', ownershipError);
          // Continue anyway - the profile is claimed. Ownership can be fixed manually if needed.
        }
      }

      // 4. Automatically sign them in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitedProfile.email,
        password: formData.password,
      });

      if (signInError) throw signInError;

      setMode('success');
      toast.success('Profile claimed successfully!');

      setTimeout(() => {
        router.push('/dashboard/select-company');
      }, 1200);

    } catch (err: any) {
      console.error('Claim error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ==================== RENDER STATES ====================

  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (mode === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-6" />
          <h1 className="text-4xl font-black tracking-[-2px] mb-4">Welcome to SupplierAdvisor!</h1>
          <p className="text-xl text-neutral-600">Your supplier profile has been activated. Redirecting...</p>
        </div>
      </div>
    );
  }

  if (error && mode !== 'claim') {
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

  // ==================== CLAIM MODE ====================
  if (mode === 'claim' && invitedProfile) {
    return (
      <div className="min-h-screen bg-[#f8fafc] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black tracking-[-3px] mb-3">Claim Your Supplier Profile</h1>
            <p className="text-xl text-neutral-600">Complete your details and create a password to get started</p>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-200 p-10">
            <div className="mb-8 pb-8 border-b">
              <div className="text-sm text-neutral-500 mb-1">You are claiming</div>
              <div className="text-4xl font-black tracking-[-2px]">{invitedProfile.trading_name}</div>
              {invitedProfile.legal_name && invitedProfile.legal_name !== invitedProfile.trading_name && (
                <div className="text-xl text-neutral-500 mt-1">{invitedProfile.legal_name}</div>
              )}
            </div>

            <form onSubmit={handleClaimProfile} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Primary Contact Name</label>
                  <input
                    type="text"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
                  />
                </div>
              </div>

              <div className="pt-6 border-t">
                <h3 className="font-semibold text-xl tracking-tight mb-6">Create Your Login Credentials</h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Email Address</label>
                    <input type="email" value={invitedProfile.email} disabled className="w-full px-6 py-4 bg-neutral-100 border border-neutral-200 rounded-2xl text-lg text-neutral-500" />
                    <p className="text-xs text-neutral-500 mt-1.5">This will be your login email</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required minLength={8}
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
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-[#00b4d8] hover:bg-[#0099b8] disabled:bg-neutral-400 text-white text-lg font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <> <Loader2 className="w-5 h-5 animate-spin" /> Claiming Profile... </>
                ) : (
                  'Claim Profile & Create Account'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Normal onboarding fallback
  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-5xl font-black tracking-[-3px] mb-4">Complete Your Business Profile</h1>
        <p className="text-xl text-neutral-600">This is the standard onboarding flow.</p>
      </div>
    </div>
  );
}