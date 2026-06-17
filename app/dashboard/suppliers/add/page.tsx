'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Upload, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AddSupplier() {
  const [form, setForm] = useState({
    legal_name: '',
    trading_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    country: '',
    province: '',
    city: '',
    registration_number: '',
    bee_level: '',
    short_description: '',
  });

  const [beeCertificateUrl, setBeeCertificateUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const uploadFileToStorage = async (file: File, folder: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from('company-documents')
      .upload(filePath, file);

    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from('company-documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleBeeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadFileToStorage(file, 'suppliers/bee-certificates');
    if (url) {
      setBeeCertificateUrl(url);
      toast.success('BEE Certificate uploaded');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.legal_name || !form.contact_email) {
      toast.error('Legal Name and Contact Email are required');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('profiles').insert({
      ...form,
      relationship_type: 'supplier',
      supplier_status: 'pending',
      bee_certificate_url: beeCertificateUrl || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Failed to add supplier');
      console.error(error);
    } else {
      toast.success('Supplier added successfully!');
      // Reset form
      setForm({
        legal_name: '', trading_name: '', contact_name: '', contact_email: '',
        contact_phone: '', country: '', province: '', city: '',
        registration_number: '', bee_level: '', short_description: '',
      });
      setBeeCertificateUrl('');
    }
    setSaving(false);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/dashboard/suppliers" className="text-[#00b4d8] hover:underline flex items-center gap-2">
          <ArrowLeft size={18} /> Back to Suppliers
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight">Add New Supplier</h1>
        <p className="text-neutral-600 mt-2">Quick onboarding. The supplier can complete their full profile later.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold mb-6">1. Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium">Legal Name *</label>
              <input className="input w-full mt-1" value={form.legal_name} onChange={e => handleInputChange('legal_name', e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Trading Name</label>
              <input className="input w-full mt-1" value={form.trading_name} onChange={e => handleInputChange('trading_name', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Registration Number</label>
              <input className="input w-full mt-1" value={form.registration_number} onChange={e => handleInputChange('registration_number', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">BEE Level</label>
              <select className="input w-full mt-1" value={form.bee_level} onChange={e => handleInputChange('bee_level', e.target.value)}>
                <option value="">Select BEE Level</option>
                <option value="Level 1">Level 1</option>
                <option value="Level 2">Level 2</option>
                <option value="Level 3">Level 3</option>
                <option value="Level 4">Level 4</option>
                <option value="Level 5">Level 5</option>
                <option value="Non-compliant">Non-compliant</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold mb-6">2. Contact Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium">Contact Person</label>
              <input className="input w-full mt-1" value={form.contact_name} onChange={e => handleInputChange('contact_name', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Email Address *</label>
              <input type="email" className="input w-full mt-1" value={form.contact_email} onChange={e => handleInputChange('contact_email', e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <input className="input w-full mt-1" value={form.contact_phone} onChange={e => handleInputChange('contact_phone', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Country</label>
              <input className="input w-full mt-1" value={form.country} onChange={e => handleInputChange('country', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Province / State</label>
              <input className="input w-full mt-1" value={form.province} onChange={e => handleInputChange('province', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <input className="input w-full mt-1" value={form.city} onChange={e => handleInputChange('city', e.target.value)} />
            </div>
          </div>
        </div>

        {/* BEE Certificate */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold mb-4">3. BEE Certificate (Optional)</h2>
          <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 bg-neutral-100 hover:bg-neutral-200 rounded-2xl text-sm font-medium">
            <Upload className="w-4 h-4" />
            Upload BEE Certificate
            <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={handleBeeUpload} />
          </label>
          {beeCertificateUrl && <span className="ml-4 text-sm text-emerald-600">✓ Uploaded</span>}
        </div>

        {/* What they supply */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <h2 className="text-xl font-bold mb-4">4. What does this supplier offer? (Optional)</h2>
          <textarea
            className="input w-full h-24"
            placeholder="e.g. Maize, Soya, Packaging, Logistics services..."
            value={form.short_description}
            onChange={e => handleInputChange('short_description', e.target.value)}
          />
        </div>

        <button 
          type="submit" 
          disabled={saving} 
          className="w-full flex items-center justify-center gap-3 bg-[#00b4d8] hover:bg-[#0096b8] text-white py-4 rounded-3xl font-semibold text-lg disabled:opacity-70"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Adding Supplier...' : 'Add Supplier'}
        </button>
      </form>
    </div>
  );
}