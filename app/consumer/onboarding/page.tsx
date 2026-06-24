'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, Upload } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function ConsumerOnboarding() {
  const supabase = createClient();
  const { user } = usePrivy();
  const router = useRouter();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    id_document_url: ''
  });

  const handleIDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `${cleanId}-id-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('certificates').upload(fileName, file, { upsert: true });
    if (error) return toast.error('Upload failed');
    const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(fileName);
    setForm(p => ({ ...p, id_document_url: publicUrl }));
    toast.success('✅ ID uploaded');
  };

  const completeRegistration = async () => {
    const { error } = await supabase.from('consumers').upsert({
      user_id: cleanId,
      ...form,
      verified: true,
      verified_at: new Date().toISOString()
    });
    if (error) toast.error('Failed');
    else {
      toast.success('🎉 Welcome to SupplierAdvisor!');
      router.push('/consumer/shop');
    }
  };

  return (
    <div className="pl-0 pr-12 py-12 bg-[#f8fafc]">
      <Breadcrumb />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Join as Consumer</h1>
        <div className="card p-12">
          <h2 className="text-3xl font-bold mb-8">Personal Details</h2>
          <input type="text" placeholder="Full Name" className="input w-full mb-6" value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))} />
          <input type="email" placeholder="Email" className="input w-full mb-6" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
          <input type="tel" placeholder="Phone" className="input w-full mb-6" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
          
          <div className="mt-12">
            <h2 className="text-3xl font-bold mb-8">Verify ID Document</h2>
            <input type="file" onChange={handleIDUpload} className="hidden" id="id-upload" />
            <label htmlFor="id-upload" className="btn-primary cursor-pointer w-full flex items-center justify-center gap-3 py-6">
              <Upload size={24} /> Upload ID Document
            </label>
          </div>

          <button onClick={completeRegistration} className="btn-primary w-full py-6 mt-12">Complete Free Registration</button>
        </div>
      </div>
    </div>
  );
}