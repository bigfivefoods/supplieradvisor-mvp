'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  FileText, Upload, Download, Trash2, Search, 
  FolderOpen, File 
} from 'lucide-react';

interface Document {
  id: number;
  name: string;
  url: string;
  category: string;
  uploaded_at: string;
  size?: number;
}

const categories = [
  'All',
  'Contracts',
  'Policies',
  'Financial',
  'HR',
  'Operations',
  'Legal',
  'Templates',
  'Other'
];

export default function Documents() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFileCategory, setSelectedFileCategory] = useState('Other');

  // Load company ID and documents
  useEffect(() => {
    const loadData = async () => {
      const storedId = localStorage.getItem('selectedCompanyId');
      if (!storedId) {
        setLoading(false);
        return;
      }

      setCompanyId(storedId);

      const { data, error } = await supabase
        .from('company_documents')
        .select('*')
        .eq('profile_id', Number(storedId))
        .order('uploaded_at', { ascending: false });

      if (data) setDocuments(data);
      if (error) console.error(error);

      setLoading(false);
    };

    loadData();
  }, []);

  // Upload document
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `companies/${companyId}/documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-documents')
        .getPublicUrl(filePath);

      // Save record to database
      const { data: newDoc, error: dbError } = await supabase
        .from('company_documents')
        .insert({
          profile_id: Number(companyId),
          name: file.name,
          url: urlData.publicUrl,
          category: selectedFileCategory,
          size: file.size,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setDocuments(prev => [newDoc, ...prev]);
      toast.success('Document uploaded successfully');
    } catch (error: any) {
      toast.error('Upload failed', {
        description: error.message,
      });
    } finally {
      setUploading(false);
      e.target.value = ''; // reset input
    }
  };

  // Delete document
  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.name}"?`)) return;

    try {
      // Delete from storage
      const filePath = doc.url.split('/company-documents/')[1];
      await supabase.storage.from('company-documents').remove([filePath]);

      // Delete from database
      await supabase.from('company_documents').delete().eq('id', doc.id);

      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="p-12 text-center">Loading documents...</div>;
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
        <h1 className="font-black text-4xl md:text-5xl tracking-[-2px]">Documents</h1>
        <p className="text-xl text-neutral-600 mt-2">Upload, organize, and manage your company documents</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#00b4d8]/10 rounded-2xl">
            <Upload className="w-6 h-6 text-[#00b4d8]" />
          </div>
          <h2 className="text-2xl font-bold">Upload New Document</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium text-neutral-600">Category</label>
            <select 
              className="input w-full mt-1" 
              value={selectedFileCategory} 
              onChange={(e) => setSelectedFileCategory(e.target.value)}
            >
              {categories.filter(c => c !== 'All').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium text-neutral-600">Choose File</label>
            <input 
              type="file" 
              className="input w-full mt-1" 
              onChange={handleUpload} 
              disabled={uploading}
            />
          </div>

          <button 
            disabled={uploading}
            className="btn-primary px-8 py-3 flex items-center gap-2 disabled:opacity-70"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-4 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search documents..."
            className="input w-full pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select 
          className="input md:w-64"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-neutral-100 rounded-2xl">
              <FolderOpen className="w-6 h-6 text-neutral-600" />
            </div>
            <h2 className="text-2xl font-bold">All Documents ({filteredDocuments.length})</h2>
          </div>
        </div>

        {filteredDocuments.length > 0 ? (
          <div className="space-y-3">
            {filteredDocuments.map((doc) => (
              <div 
                key={doc.id} 
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-neutral-50 rounded-2xl hover:bg-neutral-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-xl border">
                    <FileText className="w-6 h-6 text-neutral-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{doc.name}</p>
                    <p className="text-sm text-neutral-500">
                      {doc.category} • {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  <a 
                    href={doc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#00b4d8] hover:bg-[#00b4d8]/10 rounded-xl transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                  <button 
                    onClick={() => handleDelete(doc)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <File className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
            <p>No documents found.</p>
            <p className="text-sm mt-1">Upload your first document above.</p>
          </div>
        )}
      </div>
    </div>
  );
}