'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { ArrowLeft, UserPlus, CheckCircle, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';
import toast from 'react-hot-toast';
import Link from 'next/link';

const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_API_KEY);

export default function AddSupplierPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newSupplier, setNewSupplier] = useState<any>(null);

  const [form, setForm] = useState({
    email: '',
    legal_name: '',
    trading_name: '',
    contact_person: '',
    contact_number: '',
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

      // Create supplier record
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          email: form.email.toLowerCase().trim(),
          legal_name: form.legal_name.trim(),
          trading_name: form.trading_name.trim() || null,
          contact_name: form.contact_person.trim(),
          contact_number: form.contact_number.trim() || null,
          relationship_type: 'supplier',
          supplier_status: 'pending',
          invite_token: inviteToken,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Send invite email automatically
      await resend.emails.send({
        from: 'SupplierAdvisor <onboarding@supplieradvisor.co.za>',
        to: form.email,
        subject: `You've been invited to join SupplierAdvisor`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #00b4d8; font-size: 28px; margin-bottom: 8px;">You've been invited to join SupplierAdvisor</h1>
            
            <p style="font-size: 17px; color: #333;">Hello ${form.contact_person},</p>
            
            <p style="margin: 24px 0; color: #444; line-height: 1.6;">
              <strong>${form.legal_name}</strong> has invited you to join <strong>SupplierAdvisor</strong> as a supplier.
            </p>

            <p style="margin-bottom: 32px; color: #444;">
              Please complete your short profile to get started. It only takes a couple of minutes.
            </p>

            <a href="https://supplieradvisor.co.za/supplier/complete-profile?invite=${inviteToken}" 
               style="background: #00b4d8; color: white; padding: 14px 36px; border-radius: 9999px; text-decoration: none; font-weight: 600; display: inline-block;">
              Complete Your Profile →
            </a>

            <p style="margin-top: 48px; font-size: 13px; color: #888;">
              This invitation link will expire in 30 days.
            </p>
          </div>
        `,
      });

      setNewSupplier(data);
      setSuccess(true);
      toast.success('Supplier added and invite sent!');

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to add supplier');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      email: '',
      legal_name: '',
      trading_name: '',
      contact_person: '',
      contact_number: '',
    });
    setSuccess(false);
    setNewSupplier(null);
  };

  return (
    <div className="pl-0 pr-4 md:pr-12 py-8 md:py-12 max-w-3xl mx-auto">
      <Breadcrumb />

      {!success ? (
        <>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/dashboard/suppliers" className="text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-black text-4xl tracking-[-1.5px]">Add New Supplier</h1>
              <p className="text-neutral-600 mt-1">Quickly add a supplier and send them an invite</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-neutral-200 p-8 md:p-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="input w-full"
                  placeholder="supplier@company.com"
                  required
                />
              </div>

              {/* Legal Name */}
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

              {/* Trading Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Trading Name</label>
                <input
                  type="text"
                  value={form.trading_name}
                  onChange={(e) => handleChange('trading_name', e.target.value)}
                  className="input w-full"
                  placeholder="ABC Foods"
                />
              </div>

              {/* Contact Person */}
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

              {/* Contact Number */}
              <div>
                <label className="block text-sm font-medium mb-2">Contact Number</label>
                <input
                  type="tel"
                  value={form.contact_number}
                  onChange={(e) => handleChange('contact_number', e.target.value)}
                  className="input w-full"
                  placeholder="+27 82 123 4567"
                />
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg disabled:opacity-70"
              >
                {loading ? 'Adding Supplier & Sending Invite...' : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Add Supplier & Send Invite
                  </>
                )}
              </button>
              <p className="text-center text-xs text-neutral-500 mt-3">
                An invitation email will be sent automatically to the supplier.
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

          <h1 className="font-black text-4xl tracking-tight">Supplier Added Successfully</h1>
          <p className="text-xl text-neutral-600 mt-3">
            {newSupplier?.legal_name} has been added.<br />
            An invite has been sent to <strong>{newSupplier?.email}</strong>.
          </p>

          <div className="mt-10 space-y-4">
            <Link
              href={`/dashboard/purchase-orders/new?supplier=${newSupplier?.id}`}
              className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg"
            >
              Create Purchase Order with this Supplier
            </Link>

            <button
              onClick={resetForm}
              className="w-full flex items-center justify-center gap-3 py-4 text-lg border border-neutral-300 rounded-3xl hover:bg-neutral-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Another Supplier
            </button>

            <Link
              href="/dashboard/suppliers"
              className="block text-sm text-neutral-500 hover:text-neutral-700 mt-4"
            >
              ← Back to Suppliers List
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}