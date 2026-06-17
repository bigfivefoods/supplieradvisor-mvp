'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { ArrowLeft, Send, CheckCircle, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';
import toast from 'react-hot-toast';
import Link from 'next/link';

const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_API_KEY);

export default function InviteBusinessPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState('');

  const [form, setForm] = useState({
    email: '',
    legal_name: '',
    contact_person: '',
    note: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const generateInviteToken = () => crypto.randomUUID();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.legal_name || !form.contact_person) {
      toast.error('Email, Legal Name, and Contact Person are required');
      return;
    }

    setLoading(true);

    try {
      const inviteToken = generateInviteToken();

      // Create pending business profile
      const { error } = await supabase.from('profiles').insert({
        email: form.email.toLowerCase().trim(),
        legal_name: form.legal_name.trim(),
        contact_name: form.contact_person.trim(),
        relationship_type: 'business',
        supplier_status: 'invited',
        invite_token: inviteToken,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Send invitation email
      await resend.emails.send({
        from: 'SupplierAdvisor <invites@supplieradvisor.co.za>',
        to: form.email,
        subject: `${form.contact_person}, you've been invited to join SupplierAdvisor`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #00b4d8; font-size: 26px; margin-bottom: 8px;">You've been invited to SupplierAdvisor</h1>
            
            <p style="font-size: 17px; color: #333;">Hello ${form.contact_person},</p>
            
            <p style="margin: 24px 0; color: #444; line-height: 1.6;">
              <strong>${form.legal_name}</strong> has invited you to join <strong>SupplierAdvisor</strong> as a business.
            </p>

            ${form.note ? `<p style="margin-bottom: 24px; color: #444;"><em>"${form.note}"</em></p>` : ''}

            <p style="margin-bottom: 32px; color: #444;">
              Create your business profile to get started. Once you're set up, they can send you a connection request.
            </p>

            <a href="https://supplieradvisor.co.za/onboarding?invite=${inviteToken}" 
               style="background: #00b4d8; color: white; padding: 14px 36px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">
              Create Your Business Profile →
            </a>

            <p style="margin-top: 48px; font-size: 13px; color: #888;">
              This invitation will expire in 30 days.
            </p>
          </div>
        `,
      });

      setInvitedEmail(form.email);
      setSuccess(true);
      toast.success('Invitation sent successfully!');

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ email: '', legal_name: '', contact_person: '', note: '' });
    setSuccess(false);
    setInvitedEmail('');
  };

  return (
    <div className="pl-0 pr-4 md:pr-12 py-8 md:py-12 max-w-3xl mx-auto">
      <Breadcrumb />

      {!success ? (
        <>
          <div className="flex items-center gap-4 mb-8">
            <Link href="/dashboard/suppliers" className="text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-black text-4xl tracking-[-1.5px]">Invite a Business</h1>
              <p className="text-neutral-600 mt-1">Send an invitation to join SupplierAdvisor</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-neutral-200 p-8 md:p-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Business Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="input w-full"
                  placeholder="hello@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Legal / Registered Name *</label>
                <input
                  type="text"
                  value={form.legal_name}
                  onChange={(e) => handleChange('legal_name', e.target.value)}
                  className="input w-full"
                  placeholder="ABC Trading (Pty) Ltd"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Contact Person *</label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => handleChange('contact_person', e.target.value)}
                  className="input w-full"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Personal Note (Optional)</label>
                <textarea
                  className="input w-full h-24"
                  placeholder="Hi John, I'd love to connect with you on SupplierAdvisor..."
                  value={form.note}
                  onChange={(e) => handleChange('note', e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg disabled:opacity-70"
              >
                {loading ? 'Sending Invitation...' : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Invitation
                  </>
                )}
              </button>
              <p className="text-center text-xs text-neutral-500 mt-3">
                They will receive an email to create their business profile.
              </p>
            </div>
          </form>
        </>
      ) : (
        /* Success State */
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>

          <h1 className="font-black text-4xl tracking-tight">Invitation Sent</h1>
          <p className="text-xl text-neutral-600 mt-3">
            We've sent an invitation to <strong>{invitedEmail}</strong> to join SupplierAdvisor.
          </p>

          <div className="mt-10 space-y-4">
            <Link
              href="/dashboard/suppliers"
              className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg"
            >
              Back to Suppliers
            </Link>

            <button
              onClick={resetForm}
              className="w-full flex items-center justify-center gap-3 py-4 text-lg border border-neutral-300 rounded-3xl hover:bg-neutral-50 transition-colors"
            >
              Invite Another Business
            </button>
          </div>

          <p className="text-sm text-neutral-500 mt-8">
            Once they complete their profile, you can send them a connection request.
          </p>
        </div>
      )}
    </div>
  );
}