'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { 
  ShieldCheck, FileText, Award, UserCheck, 
  Upload, ExternalLink, Download 
} from 'lucide-react';

interface LegalDocuments {
  cipc_certificate_url?: string;
  tax_clearance_url?: string;
  bee_certificate_url?: string;
  vat_certificate_url?: string;
  director_id_url?: string;
  popia_policy_url?: string;
}

export default function LegalAndCompliance() {
  const supabase = createClient();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<LegalDocuments>({});

  // Form fields
  const [form, setForm] = useState({
    registration_number: '',
    tax_number: '',
    bee_level: '',
    bee_expiry: '',
    id_number: '',
  });

  // Load company ID and existing documents
  useEffect(() => {
    const loadData = async () => {
      const storedCompanyId = localStorage.getItem('selectedCompanyId');
      if (!storedCompanyId) {
        setLoading(false);
        return;
      }

      setCompanyId(storedCompanyId);

      const { data: row } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', Number(storedCompanyId))
        .single();

      if (row) {
        setForm({
          registration_number: row.registration_number || '',
          tax_number: row.tax_number || '',
          bee_level: row.bee_level || '',
          bee_expiry: row.bee_expiry || '',
          id_number: row.director_id_number || '',
        });

        setDocuments({
          cipc_certificate_url: row.cipc_certificate_url,
          tax_clearance_url: row.tax_clearance_url,
          bee_certificate_url: row.bee_certificate_url,
          vat_certificate_url: row.vat_certificate_url,
          director_id_url: row.director_id_url,
          popia_policy_url: row.popia_policy_url,
        });
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  // Upload file to Supabase Storage
  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    if (!companyId) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `companies/${companyId}/legal/${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from('company-documents')
      .upload(filePath, file);

    if (error) {
      toast.error('Upload failed', {
        description: error.message,
      });
      return null;
    }

    const { data } = supabase.storage
      .from('company-documents')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // Handle file upload + save to DB
  const handleFileUpload = async (field: keyof LegalDocuments, file: File) => {
    if (!companyId) return;

    const url = await uploadFile(file, field);
    if (!url) return;

    const updatedDocs = { ...documents, [field]: url };
    setDocuments(updatedDocs);

    // Save immediately to database
    await supabase
      .from('profiles')
      .update({ [field]: url })
      .eq('id', Number(companyId));

    toast.success(`${file.name} uploaded successfully`);
  };

  // Save other form fields
  const saveForm = async () => {
    if (!companyId) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        registration_number: form.registration_number,
        tax_number: form.tax_number,
        bee_level: form.bee_level,
        bee_expiry: form.bee_expiry,
        director_id_number: form.id_number,
      })
      .eq('id', Number(companyId));

    if (error) {
      toast.error('Failed to save changes');
    } else {
      toast.success('Changes saved successfully');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-12 text-center">Loading legal documents...</div>;
  }

  if (!companyId) {
    return (
      <div className="p-12 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">No Company Selected</h2>
        <p className="text-neutral-600 mb-6">Please select a company first.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-8 py-3">
          Select Company
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="mb-10">
        <Link href="/dashboard/my-business" className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-2">
          ← Back to My Business
        </Link>
        <h1 className="font-black text-4xl md:text-5xl tracking-[-2px]">Legal &amp; Compliance</h1>
        <p className="text-xl text-neutral-600 mt-2">Manage your company’s legal documents and compliance status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Company Registration */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#00b4d8]/10 rounded-2xl">
              <FileText className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <h2 className="text-2xl font-bold">Company Registration</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-neutral-600">CIPC Registration Certificate</label>
              <div className="mt-2 flex items-center gap-3">
                <input 
                  type="file" 
                  className="input flex-1" 
                  onChange={(e) => e.target.files?.[0] && handleFileUpload('cipc_certificate_url', e.target.files[0])} 
                />
                {documents.cipc_certificate_url && (
                  <a href={documents.cipc_certificate_url} target="_blank" className="text-[#00b4d8] flex items-center gap-1 text-sm">
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">Company Registration Number</label>
              <input 
                type="text" 
                className="input w-full mt-1" 
                value={form.registration_number} 
                onChange={(e) => setForm({ ...form, registration_number: e.target.value })} 
              />
            </div>
          </div>
        </div>

        {/* Tax & VAT Compliance */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-100 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold">Tax &amp; VAT Compliance</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-neutral-600">Tax Clearance Certificate</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="file" className="input flex-1" onChange={(e) => e.target.files?.[0] && handleFileUpload('tax_clearance_url', e.target.files[0])} />
                {documents.tax_clearance_url && (
                  <a href={documents.tax_clearance_url} target="_blank" className="text-emerald-600 flex items-center gap-1 text-sm">
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">VAT Certificate</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="file" className="input flex-1" onChange={(e) => e.target.files?.[0] && handleFileUpload('vat_certificate_url', e.target.files[0])} />
                {documents.vat_certificate_url && (
                  <a href={documents.vat_certificate_url} target="_blank" className="text-emerald-600 flex items-center gap-1 text-sm">
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">Tax Number</label>
              <input type="text" className="input w-full mt-1" value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
            </div>
          </div>
        </div>

        {/* B-BBEE Compliance */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <Award className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold">B-BBEE Compliance</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-neutral-600">B-BBEE Level</label>
              <select className="input w-full mt-1" value={form.bee_level} onChange={(e) => setForm({ ...form, bee_level: e.target.value })}>
                <option value="">Select Level</option>
                {['Level 1','Level 2','Level 3','Level 4','Level 5','Level 6','Level 7','Level 8'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">B-BBEE Certificate</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="file" className="input flex-1" onChange={(e) => e.target.files?.[0] && handleFileUpload('bee_certificate_url', e.target.files[0])} />
                {documents.bee_certificate_url && (
                  <a href={documents.bee_certificate_url} target="_blank" className="text-amber-600 flex items-center gap-1 text-sm">
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">Certificate Expiry Date</label>
              <input type="date" className="input w-full mt-1" value={form.bee_expiry} onChange={(e) => setForm({ ...form, bee_expiry: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Director Verification */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 rounded-2xl">
              <UserCheck className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold">Director Verification</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-neutral-600">Director ID Document</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="file" className="input flex-1" onChange={(e) => e.target.files?.[0] && handleFileUpload('director_id_url', e.target.files[0])} />
                {documents.director_id_url && (
                  <a href={documents.director_id_url} target="_blank" className="text-purple-600 flex items-center gap-1 text-sm">
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">Director ID Number</label>
              <input type="text" className="input w-full mt-1" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Regulatory Compliance */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8 lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold">Regulatory Compliance</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-neutral-600">POPIA Policy Document</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="file" className="input flex-1" onChange={(e) => e.target.files?.[0] && handleFileUpload('popia_policy_url', e.target.files[0])} />
                {documents.popia_policy_url && (
                  <a href={documents.popia_policy_url} target="_blank" className="text-blue-600 flex items-center gap-1 text-sm">
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">Health &amp; Safety Status</label>
              <select className="input w-full mt-1">
                <option value="">Select Status</option>
                <option value="Compliant">Fully Compliant</option>
                <option value="In Progress">In Progress</option>
                <option value="Not Started">Not Started</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end mt-8">
        <button 
          onClick={saveForm} 
          disabled={saving}
          className="btn-primary px-10 py-4 disabled:opacity-70"
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}