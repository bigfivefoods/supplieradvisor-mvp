'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function AddNewSupplier() {
  const [formData, setFormData] = useState({
    trading_name: '',
    legal_name: '',
    registration_number: '',
    category: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_position: '',
    website: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const invitedBy = localStorage.getItem('selectedCompanyName') || 'Your Business';

      // Send invitation via the improved API route
      const response = await fetch('/api/send-supplier-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trading_name: formData.trading_name,
          contact_name: formData.contact_name,
          contact_email: formData.contact_email,
          invitedBy: invitedBy,
          category: formData.category,
          contact_phone: formData.contact_phone,
          website: formData.website,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-8">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="font-black text-4xl tracking-tight mb-4">Invitation Sent</h1>
        <p className="text-xl text-neutral-600 mb-4">
          We've sent an invitation to <span className="font-semibold">{formData.contact_email}</span>.
        </p>
        <p className="text-neutral-600 mb-10">
          {formData.trading_name} will receive a professional email from <strong>{localStorage.getItem('selectedCompanyName') || 'your business'}</strong> 
          with instructions to complete their supplier profile on SupplierAdvisor.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/dashboard/suppliers/directory" className="btn-primary px-8 py-3">
            View Supplier Directory
          </Link>
          <Link 
            href="/dashboard/suppliers/add" 
            className="btn-secondary px-8 py-3"
            onClick={() => window.location.reload()}
          >
            Invite Another Supplier
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-10">
        <Link href="/dashboard/suppliers" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Suppliers
        </Link>
        <h1 className="font-black text-5xl tracking-[-2px]">Add New Supplier</h1>
        <p className="text-xl text-neutral-600 mt-3">
          Invite a supplier to join SupplierAdvisor. They will receive a professional invitation from your business.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        
        {/* Company Details */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h3 className="font-bold text-2xl tracking-tight mb-6">Company Details</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Trading Name *</label>
              <input
                type="text"
                name="trading_name"
                value={formData.trading_name}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
                placeholder="Acme Fresh Produce"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Legal Name</label>
              <input
                type="text"
                name="legal_name"
                value={formData.legal_name}
                onChange={handleChange}
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
                placeholder="Acme Fresh Produce (Pty) Ltd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Registration Number</label>
              <input
                type="text"
                name="registration_number"
                value={formData.registration_number}
                onChange={handleChange}
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category / Industry</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
                placeholder="Fresh Produce, Logistics, Packaging..."
              />
            </div>
          </div>
        </div>

        {/* Primary Contact */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h3 className="font-bold text-2xl tracking-tight mb-6">Primary Contact Person</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Full Name *</label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
                placeholder="John Dlamini"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Position / Title</label>
              <input
                type="text"
                name="contact_position"
                value={formData.contact_position}
                onChange={handleChange}
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
                placeholder="Procurement Manager"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email Address *</label>
              <input
                type="email"
                name="contact_email"
                value={formData.contact_email}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
                placeholder="john@acmefresh.co.za"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
                placeholder="+27 82 123 4567"
              />
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h3 className="font-bold text-2xl tracking-tight mb-6">Additional Information</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8]"
                placeholder="https://www.acmefresh.co.za"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Internal Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-[#00b4d8] resize-y"
                placeholder="Any internal notes about this supplier (optional)..."
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading || !formData.trading_name || !formData.contact_email}
            className="btn-primary px-10 py-4 text-base disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? 'Sending Invitation...' : 'Send Invitation to Supplier'}
          </button>
        </div>
      </form>
    </div>
  );
}