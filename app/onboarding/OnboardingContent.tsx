'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronDown, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function OnboardingContent() {
  const { user } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();

  const cleanId = (user?.id || '').replace('privy:', '');
  const inviteToken = searchParams.get('invite');

  const [saving, setSaving] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [isInviteFlow, setIsInviteFlow] = useState(false);

  const [form, setForm] = useState({
    legal_name: '',
    trading_name: '',
    contact_name: '',
    email: '',
    contact_number: '',
    business_type: '',
    continent: '',
    country: '',
    province: '',
    city: '',
    street: '',
    postal_code: '',
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    basics: true,
    location: true,
  });

  // ==================== IMPROVED INVITE TOKEN HANDLING ====================
  useEffect(() => {
    const checkInviteToken = async () => {
      if (!inviteToken) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('invite_token', inviteToken)
        .eq('supplier_status', 'invited')
        .single();

      if (error || !data) {
        toast.error('This invitation link is invalid or has already been claimed.');
        return;
      }

      setInviteData(data);
      setIsInviteFlow(true);

      // Pre-fill form with invited supplier data
      setForm(prev => ({
        ...prev,
        email: data.email || '',
        trading_name: data.trading_name || '',
        legal_name: data.legal_name || data.trading_name || '',
        contact_name: data.contact_name || '',
        contact_number: data.contact_phone || '',
      }));

      toast.success('Invitation confirmed. Please review and complete your profile.');
    };

    checkInviteToken();
  }, [inviteToken]);

  const toggleSection = (section: string) => {
    setExpanded(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ==================== IMPROVED SAVE / CLAIM LOGIC ====================
  const saveProfile = async () => {
    setSaving(true);

    try {
      const profileUpdate: any = {
        legal_name: form.legal_name,
        trading_name: form.trading_name,
        contact_name: form.contact_name,
        email: form.email,
        contact_phone: form.contact_number,
        business_type: form.business_type,
        continent: form.continent,
        country: form.country,
        province: form.province,
        city: form.city,
        street: form.street,
        postal_code: form.postal_code,
        updated_at: new Date().toISOString(),
      };

      let error;

      if (isInviteFlow && inviteData) {
        // === CLAIM FLOW: Update the existing invited record ===
        profileUpdate.supplier_status = 'active';
        profileUpdate.claimed_at = new Date().toISOString();
        profileUpdate.invite_token = null;

        ({ error } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('invite_token', inviteToken));
      } else {
        // Normal new onboarding
        ({ error } = await supabase.from('profiles').upsert(profileUpdate));
      }

      if (error) throw error;

      // Create ownership record in business_users
      if (cleanId) {
        await supabase.from('business_users').upsert({
          user_id: cleanId,
          profile_id: cleanId,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        }, { onConflict: 'user_id,profile_id' });
      }

      toast.success(
        isInviteFlow 
          ? "🎉 Profile claimed successfully! Welcome to SupplierAdvisor." 
          : "Profile saved successfully!"
      );

      setTimeout(() => {
        router.push('/dashboard/select-company');
      }, 1200);

    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">
            {isInviteFlow ? 'Claim Your Supplier Profile' : 'Complete Your Business Profile'}
          </h1>
          <p className="text-xl text-neutral-600 mt-2">
            {isInviteFlow 
              ? 'You have been invited to join SupplierAdvisor as a verified supplier.' 
              : 'Verify and complete your company details'}
          </p>
        </div>
      </div>

      {/* Invite Banner */}
      {isInviteFlow && inviteData && (
        <div className="mb-8 p-6 bg-emerald-50 border border-emerald-200 rounded-3xl">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-8 h-8 text-emerald-600 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-800 text-lg">
                Invitation Confirmed
              </div>
              <p className="text-emerald-700 mt-1">
                You are claiming ownership of <strong>{inviteData.trading_name}</strong>. 
                Please review the details below and activate your supplier profile.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">

        {/* 1. Company Details */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div 
            className="flex justify-between items-center mb-6 cursor-pointer" 
            onClick={() => toggleSection('basics')}
          >
            <h2 className="text-2xl font-bold">1. Company Details</h2>
            <ChevronDown className={`transition ${expanded.basics ? 'rotate-180' : ''}`} />
          </div>

          {expanded.basics && (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Legal Name</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  value={form.legal_name} 
                  onChange={e => setForm(p => ({...p, legal_name: e.target.value}))} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Trading Name</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  value={form.trading_name} 
                  onChange={e => setForm(p => ({...p, trading_name: e.target.value}))} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contact Name</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  value={form.contact_name} 
                  onChange={e => setForm(p => ({...p, contact_name: e.target.value}))} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contact Number</label>
                <input 
                  type="tel" 
                  className="input w-full" 
                  value={form.contact_number} 
                  onChange={e => setForm(p => ({...p, contact_number: e.target.value}))} 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input 
                  type="email" 
                  className="input w-full bg-neutral-100" 
                  value={form.email} 
                  disabled 
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Location */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div 
            className="flex justify-between items-center mb-6 cursor-pointer" 
            onClick={() => toggleSection('location')}
          >
            <h2 className="text-2xl font-bold">2. Location</h2>
            <ChevronDown className={`transition ${expanded.location ? 'rotate-180' : ''}`} />
          </div>

          {expanded.location && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input 
                type="text" 
                className="input w-full" 
                placeholder="Continent" 
                value={form.continent} 
                onChange={e => setForm(p => ({...p, continent: e.target.value}))} 
              />
              <input 
                type="text" 
                className="input w-full" 
                placeholder="Country" 
                value={form.country} 
                onChange={e => setForm(p => ({...p, country: e.target.value}))} 
              />
              <input 
                type="text" 
                className="input w-full" 
                placeholder="Province / State" 
                value={form.province} 
                onChange={e => setForm(p => ({...p, province: e.target.value}))} 
              />
              <input 
                type="text" 
                className="input w-full" 
                placeholder="City" 
                value={form.city} 
                onChange={e => setForm(p => ({...p, city: e.target.value}))} 
              />
              <input 
                type="text" 
                className="input w-full md:col-span-2" 
                placeholder="Street Address" 
                value={form.street} 
                onChange={e => setForm(p => ({...p, street: e.target.value}))} 
              />
              <input 
                type="text" 
                className="input w-full" 
                placeholder="Postal Code" 
                value={form.postal_code} 
                onChange={e => setForm(p => ({...p, postal_code: e.target.value}))} 
              />
            </div>
          )}
        </div>

      </div>

      {/* Final Button */}
      <div className="flex justify-end mt-12">
        <button 
          onClick={saveProfile} 
          disabled={saving}
          className="btn-primary flex items-center gap-3 px-10 py-4 text-lg disabled:opacity-70"
        >
          {saving 
            ? 'Processing...' 
            : isInviteFlow 
              ? 'Claim & Activate Supplier Profile' 
              : 'Complete Onboarding'}
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}