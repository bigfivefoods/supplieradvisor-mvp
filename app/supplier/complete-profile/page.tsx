'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function SupplierCompleteProfile() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteToken = searchParams.get('invite');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);

  const [form, setForm] = useState({
    trading_name: '',
    contact_name: '',
    contact_number: '',
    country: '',
    city: '',
    what_you_supply: '',
    bank_name: '',
    account_number: '',
  });

  // Load invite data
  useEffect(() => {
    const loadInvite = async () => {
      if (!inviteToken) {
        toast.error('Invalid or missing invitation link');
        router.push('/');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('invite_token', inviteToken)
        .eq('supplier_status', 'pending')
        .single();

      if (error || !data) {
        toast.error('This invitation link is invalid or has expired');
        router.push('/');
        return;
      }

      setInviteData(data);

      // Pre-fill what we already know
      setForm(prev => ({
        ...prev,
        trading_name: data.trading_name || '',
        contact_name: data.contact_name || '',
        contact_number: data.contact_number || '',
      }));

      setLoading(false);
    };

    loadInvite();
  }, [inviteToken, router]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          trading_name: form.trading_name || null,
          contact_name: form.contact_name,
          contact_number: form.contact_number || null,
          country: form.country || null,
          city: form.city || null,
          short_description: form.what_you_supply || null,
          bank_name: form.bank_name || null,
          account_number: form.account_number || null,
          supplier_status: 'active',
          invite_token: null,           // Clear the token
          updated_at: new Date().toISOString(),
        })
        .eq('id', inviteData.id);

      if (error) throw error;

      toast.success('Profile activated! Welcome to SupplierAdvisor.');

      // Redirect to a simple welcome or dashboard
      router.push('/supplier/welcome');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00b4d8] mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="font-black text-4xl tracking-tight">Complete Your Supplier Profile</h1>
        <p className="text-xl text-neutral-600 mt-2">
          Welcome, {inviteData?.legal_name}. Just a few quick details to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Company Basics */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h2 className="font-semibold text-xl mb-6">Company Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium">Trading Name</label>
              <input
                className="input w-full mt-1"
                value={form.trading_name}
                onChange={(e) => handleChange('trading_name', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contact Person *</label>
              <input
                className="input w-full mt-1"
                value={form.contact_name}
                onChange={(e) => handleChange('contact_name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contact Number</label>
              <input
                className="input w-full mt-1"
                value={form.contact_number}
                onChange={(e) => handleChange('contact_number', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Country</label>
              <input
                className="input w-full mt-1"
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <input
                className="input w-full mt-1"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* What you supply */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h2 className="font-semibold text-xl mb-4">What do you supply?</h2>
          <textarea
            className="input w-full h-24"
            placeholder="e.g. Maize meal, Soya products, Packaging materials, Logistics..."
            value={form.what_you_supply}
            onChange={(e) => handleChange('what_you_supply', e.target.value)}
          />
          <p className="text-xs text-neutral-500 mt-2">This helps us match you with relevant purchase orders.</p>
        </div>

        {/* Basic Banking (Optional but useful) */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h2 className="font-semibold text-xl mb-6">Banking Details (Optional)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium">Bank Name</label>
              <input
                className="input w-full mt-1"
                value={form.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Account Number</label>
              <input
                className="input w-full mt-1"
                value={form.account_number}
                onChange={(e) => handleChange('account_number', e.target.value)}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg"
        >
          {saving ? 'Activating Your Profile...' : (
            <>
              Activate My Supplier Profile <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-neutral-500">
          You can complete more details (products, certifications, full banking) later from your dashboard.
        </p>
      </form>
    </div>
  );
}