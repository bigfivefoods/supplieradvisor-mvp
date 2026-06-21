'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface SupplierProfile {
  public_id: string;
  trading_name: string;
  legal_name: string | null;
  email: string;
  contact_name: string | null;
  contact_phone: string | null;
  category: string | null;
  supplier_status: string;
}

export default function JoinSupplierPage() {
  const params = useParams();
  const router = useRouter();
  const publicId = params.public_id as string;

  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_phone: '',
    password: '',
    confirmPassword: '',
  });

  // Fetch supplier details
  useEffect(() => {
    const fetchSupplier = async () => {
      if (!publicId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('public_id, trading_name, legal_name, email, contact_name, contact_phone, category, supplier_status')
        .eq('public_id', publicId)
        .single();

      if (error || !data) {
        setError('This invitation link is invalid or has expired.');
      } else if (data.supplier_status === 'active') {
        setError('This supplier has already joined SupplierAdvisor.');
      } else {
        setSupplier(data as SupplierProfile);
        // Pre-fill form with existing data
        setFormData(prev => ({
          ...prev,
          contact_name: data.contact_name || '',
          contact_phone: data.contact_phone || '',
        }));
      }
      setLoading(false);
    };

    fetchSupplier();
  }, [publicId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplier) return;

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: supplier.email,
        password: formData.password,
        options: {
          data: {
            trading_name: supplier.trading_name,
            public_id: supplier.public_id,
          },
        },
      });

      if (authError) throw authError;

      // 2. Update the profile to active + claimed
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          supplier_status: 'active',
          claimed_at: new Date().toISOString(),
          contact_name: formData.contact_name,
          contact_phone: formData.contact_phone,
        })
        .eq('public_id', supplier.public_id);

      if (updateError) throw updateError;

      setSuccess(true);

      // Redirect to login after 2.5 seconds
      setTimeout(() => {
        router.push('/login?claimed=true');
      }, 2500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-6" />
          <h1 className="text-3xl font-bold tracking-tight mb-4">Unable to Join</h1>
          <p className="text-lg text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-6" />
          <h1 className="text-4xl font-black tracking-[-2px] mb-4">Welcome to SupplierAdvisor!</h1>
          <p className="text-xl text-neutral-600 mb-8">
            Your account has been created successfully. You will be redirected to login.
          </p>
          <p className="text-sm text-neutral-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-[-3px] mb-3">Join SupplierAdvisor</h1>
          <p className="text-xl text-neutral-600">Complete your profile to get started</p>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-10">
          {/* Supplier Info */}
          <div className="mb-8 pb-8 border-b">
            <div className="text-sm text-neutral-500 mb-1">You are joining as</div>
            <div className="text-4xl font-black tracking-[-2px]">{supplier?.trading_name}</div>
            {supplier?.legal_name && supplier.legal_name !== supplier.trading_name && (
              <div className="text-xl text-neutral-500 mt-1">{supplier.legal_name}</div>
            )}
          </div>

          <form onSubmit={handleClaim} className="space-y-8">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Primary Contact Name</label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleInputChange}
                required
                className="w-full px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
                placeholder="John Doe"
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
                placeholder="+27 XX XXX XXXX"
              />
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold text-xl tracking-tight mb-6">Create Your Login</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={supplier?.email}
                    disabled
                    className="w-full px-6 py-4 bg-neutral-100 border border-neutral-200 rounded-2xl text-lg text-neutral-500"
                  />
                  <p className="text-xs text-neutral-500 mt-1.5">This email will be used to log in</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength={6}
                    className="w-full px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
                    placeholder="Create a password"
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
              disabled={submitting}
              className="w-full py-4 bg-[#00b4d8] hover:bg-[#0099b8] disabled:bg-neutral-400 text-white text-lg font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Creating Account...
                </>
              ) : (
                'Join SupplierAdvisor'
              )}
            </button>

            <p className="text-center text-xs text-neutral-500">
              By joining, you agree to SupplierAdvisor’s Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}