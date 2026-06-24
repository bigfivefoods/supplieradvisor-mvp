'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';

export default function InviteBusinessPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const generateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !businessName) return;

    setLoading(true);

    const token = crypto.randomUUID();

    const { error } = await supabase.from('profiles').insert({
      email: email.toLowerCase().trim(),
      trading_name: businessName,
      relationship_type: 'business',
      supplier_status: 'invited',
      invite_token: token,
      created_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Failed to create invite. Email might already exist.');
      console.error(error);
    } else {
      const link = `${window.location.origin}/supplier/complete-profile?token=${token}`;
      setInviteLink(link);
      toast.success('Invite created successfully!');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/suppliers" className="text-neutral-500 hover:text-neutral-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-black text-4xl tracking-tight">Invite New Business</h1>
          <p className="text-neutral-600">Send an onboarding link to a new supplier or partner</p>
        </div>
      </div>

      {!inviteLink ? (
        <form onSubmit={generateInvite} className="space-y-6 bg-white border border-neutral-200 rounded-3xl p-8">
          <div>
            <label className="text-sm font-medium">Business / Company Name</label>
            <input
              type="text"
              className="input w-full mt-1"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Contact Email</label>
            <input
              type="email"
              className="input w-full mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-lg mt-4"
          >
            {loading ? 'Creating Invite...' : (
              <>Generate Invite Link <Send className="w-5 h-5" /></>
            )}
          </button>
        </form>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-3xl p-8">
          <h2 className="font-semibold text-2xl mb-4">Invite Created Successfully</h2>
          <p className="text-neutral-600 mb-4">Share this link with the business:</p>
          
          <div className="bg-neutral-100 p-4 rounded-2xl break-all text-sm mb-6">
            {inviteLink}
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteLink);
              toast.success('Link copied to clipboard');
            }}
            className="btn-primary w-full py-3 mb-3"
          >
            Copy Link
          </button>

          <button
            onClick={() => {
              setInviteLink('');
              setEmail('');
              setBusinessName('');
            }}
            className="w-full py-3 border border-neutral-300 rounded-2xl"
          >
            Invite Another Business
          </button>
        </div>
      )}
    </div>
  );
}