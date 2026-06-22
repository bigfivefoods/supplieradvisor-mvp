'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimed = searchParams.get('claimed');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard/select-company');
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-[-2px] mb-2">Welcome Back</h1>
        <p className="text-neutral-600">Sign in to SupplierAdvisor</p>
      </div>

      {claimed && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm">
          Account created successfully! Please log in with your new password.
        </div>
      )}

      <form onSubmit={handleLogin} className="bg-white rounded-3xl border border-neutral-200 p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-6 py-4 border border-neutral-200 rounded-2xl text-lg focus:outline-none focus:border-[#00b4d8]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-[#00b4d8] text-white text-lg font-semibold rounded-2xl disabled:bg-neutral-400 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
      <Suspense fallback={<div className="text-neutral-500">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}