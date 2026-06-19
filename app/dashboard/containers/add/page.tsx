'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AddContainer() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // TODO: Connect to Supabase later
    const formData = new FormData(e.currentTarget);
    
    console.log('Form submitted:', Object.fromEntries(formData));
    
    // Simulate processing
    setTimeout(() => {
      setLoading(false);
      alert('Container created successfully! (Frontend only for now)');
    }, 800);
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      
      <div className="flex items-center gap-4 mb-8">
        <Link 
          href="/dashboard/containers" 
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Containers
        </Link>
      </div>

      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-2">Add New Container</h1>
      <p className="text-xl text-neutral-600 mb-8">Onboard a new retail outlet and appoint an independent contractor</p>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
        
        {/* Container Information */}
        <div className="bg-white rounded-3xl p-8 border">
          <h2 className="text-2xl font-bold mb-6">Container Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Container Name / Nickname</label>
              <input 
                type="text" 
                name="name" 
                required 
                className="w-full px-4 py-3 rounded-2xl border border-neutral-300 focus:outline-none focus:border-[#00b4d8]" 
                placeholder="e.g. Nongoma Spaza 01"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Container Type</label>
              <select name="type" className="w-full px-4 py-3 rounded-2xl border border-neutral-300 focus:outline-none focus:border-[#00b4d8]">
                <option value="standard">Standard (6m)</option>
                <option value="large">Large (12m)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-3xl p-8 border">
          <h2 className="text-2xl font-bold mb-6">Location</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Country</label>
              <input type="text" name="country" defaultValue="South Africa" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Province / State</label>
              <input type="text" name="province" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" placeholder="e.g. KwaZulu-Natal" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-2">Full Address</label>
              <input type="text" name="address" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" placeholder="Street address or landmark" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Latitude</label>
              <input type="text" name="latitude" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" placeholder="-28.123456" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Longitude</label>
              <input type="text" name="longitude" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" placeholder="30.987654" />
            </div>
          </div>
        </div>

        {/* Contractor */}
        <div className="bg-white rounded-3xl p-8 border">
          <h2 className="text-2xl font-bold mb-6">Contractor Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Full Name</label>
              <input type="text" name="contractor_name" required className="w-full px-4 py-3 rounded-2xl border border-neutral-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Phone Number</label>
              <input type="tel" name="contractor_phone" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">ID Number</label>
              <input type="text" name="contractor_id_number" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
              <input type="email" name="contractor_email" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" />
            </div>
          </div>
        </div>

        {/* Contract Terms */}
        <div className="bg-white rounded-3xl p-8 border">
          <h2 className="text-2xl font-bold mb-6">Contract Terms</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Contract Start Date</label>
              <input type="date" name="start_date" required className="w-full px-4 py-3 rounded-2xl border border-neutral-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Contract End Date</label>
              <input type="date" name="end_date" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Commission Rate (%)</label>
              <input type="number" name="commission_rate" defaultValue="15" step="0.5" className="w-full px-4 py-3 rounded-2xl border border-neutral-300" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className="bg-[#00b4d8] text-white px-8 py-4 rounded-2xl font-semibold hover:bg-[#0096b8] transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Container...' : 'Create Container & Contract'}
          </button>
        </div>
      </form>
    </div>
  );
}