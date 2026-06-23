'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function SupplierProfilePage() {
  const { user } = usePrivy();
  const cleanId = (user?.id || '').replace('privy:', '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    legal_name: '',
    trading_name: '',
    contact_name: '',
    email: '',
    contact_number: '',
    country: '',
    city: '',
    province: '',
    short_description: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    iban: '',
    swift: '',
  });

  // Products & Services state
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [newProduct, setNewProduct] = useState({ description: '', sku: '', uom: '', sell_price: '', lead_time_days: '' });
  const [newService, setNewService] = useState('');

  // Load profile + products + services
  useEffect(() => {
    const loadData = async () => {
      if (!cleanId) return;

      const [profileRes, productsRes, servicesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', cleanId).single(),
        supabase.from('business_products').select('*').eq('profile_id', cleanId),
        supabase.from('business_services').select('*').eq('profile_id', cleanId),
      ]);

      if (profileRes.data) {
        setForm({
          legal_name: profileRes.data.legal_name || '',
          trading_name: profileRes.data.trading_name || '',
          contact_name: profileRes.data.contact_name || '',
          email: profileRes.data.email || '',
          contact_number: profileRes.data.contact_number || '',
          country: profileRes.data.country || '',
          city: profileRes.data.city || '',
          province: profileRes.data.province || '',
          short_description: profileRes.data.short_description || '',
          bank_name: profileRes.data.bank_name || '',
          account_name: profileRes.data.account_name || '',
          account_number: profileRes.data.account_number || '',
          iban: profileRes.data.iban || '',
          swift: profileRes.data.swift || '',
        });
      }

      if (productsRes.data) setProducts(productsRes.data);
      if (servicesRes.data) setServices(servicesRes.data.map((s: any) => s.name));

      setLoading(false);
    };

    loadData();
  }, [cleanId]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // ==================== PRODUCTS ====================
  const addProduct = async () => {
    if (!newProduct.description) return toast.error('Product description is required');

    const productData = {
      profile_id: cleanId,
      description: newProduct.description,
      sku: newProduct.sku || null,
      uom: newProduct.uom || null,
      sell_price: newProduct.sell_price ? parseFloat(newProduct.sell_price) : null,
      lead_time_days: newProduct.lead_time_days ? parseInt(newProduct.lead_time_days) : null,
    };

    const { data, error } = await supabase.from('business_products').insert(productData).select().single();

    if (error) return toast.error('Failed to add product');

    setProducts([...products, data]);
    setNewProduct({ description: '', sku: '', uom: '', sell_price: '', lead_time_days: '' });
    toast.success('Product added');
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('business_products').delete().eq('id', id);
    if (error) return toast.error('Failed to delete product');

    setProducts(products.filter(p => p.id !== id));
    toast.success('Product removed');
  };

  // ==================== SERVICES ====================
  const addService = async () => {
    if (!newService) return;

    const { error } = await supabase.from('business_services').insert({
      profile_id: cleanId,
      name: newService,
    });

    if (error) return toast.error('Failed to add service');

    setServices([...services, newService]);
    setNewService('');
    toast.success('Service added');
  };

  const deleteService = async (index: number) => {
    const serviceName = services[index];
    const { error } = await supabase.from('business_services').delete().eq('profile_id', cleanId).eq('name', serviceName);
    if (error) return toast.error('Failed to delete service');

    setServices(services.filter((_, i) => i !== index));
    toast.success('Service removed');
  };

  // ==================== SAVE PROFILE ====================
  const handleSave = async () => {
    if (!cleanId) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('user_id', cleanId);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile saved successfully');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-[#00b4d8] rounded-full"></div></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-neutral-500 hover:text-neutral-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-black text-4xl tracking-tight">My Supplier Profile</h1>
          <p className="text-neutral-600">Keep your information up to date</p>
        </div>
      </div>

      {/* Company Information */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
        <h2 className="font-semibold text-xl mb-6">Company Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="text-sm font-medium">Legal Name</label><input className="input w-full mt-1" value={form.legal_name} onChange={e => handleChange('legal_name', e.target.value)} /></div>
          <div><label className="text-sm font-medium">Trading Name</label><input className="input w-full mt-1" value={form.trading_name} onChange={e => handleChange('trading_name', e.target.value)} /></div>
          <div><label className="text-sm font-medium">Contact Person</label><input className="input w-full mt-1" value={form.contact_name} onChange={e => handleChange('contact_name', e.target.value)} /></div>
          <div><label className="text-sm font-medium">Email</label><input className="input w-full mt-1" value={form.email} onChange={e => handleChange('email', e.target.value)} /></div>
          <div><label className="text-sm font-medium">Contact Number</label><input className="input w-full mt-1" value={form.contact_number} onChange={e => handleChange('contact_number', e.target.value)} /></div>
        </div>
      </div>

      {/* Location */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
        <h2 className="font-semibold text-xl mb-6">Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><label className="text-sm font-medium">Country</label><input className="input w-full mt-1" value={form.country} onChange={e => handleChange('country', e.target.value)} /></div>
          <div><label className="text-sm font-medium">Province</label><input className="input w-full mt-1" value={form.province} onChange={e => handleChange('province', e.target.value)} /></div>
          <div><label className="text-sm font-medium">City</label><input className="input w-full mt-1" value={form.city} onChange={e => handleChange('city', e.target.value)} /></div>
        </div>
      </div>

      {/* What You Supply */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
        <h2 className="font-semibold text-xl mb-4">What do you supply?</h2>
        <textarea className="input w-full h-24" value={form.short_description} onChange={e => handleChange('short_description', e.target.value)} />
      </div>

      {/* Banking */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
        <h2 className="font-semibold text-xl mb-6">Banking Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="text-sm font-medium">Bank Name</label><input className="input w-full mt-1" value={form.bank_name} onChange={e => handleChange('bank_name', e.target.value)} /></div>
          <div><label className="text-sm font-medium">Account Name</label><input className="input w-full mt-1" value={form.account_name} onChange={e => handleChange('account_name', e.target.value)} /></div>
          <div><label className="text-sm font-medium">Account Number</label><input className="input w-full mt-1" value={form.account_number} onChange={e => handleChange('account_number', e.target.value)} /></div>
          <div><label className="text-sm font-medium">IBAN / SWIFT</label><input className="input w-full mt-1" value={form.iban} onChange={e => handleChange('iban', e.target.value)} /></div>
        </div>
      </div>

      {/* ==================== PRODUCTS ==================== */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 mb-8">
        <h2 className="font-semibold text-xl mb-6">Products You Offer</h2>

        {/* Add Product Form */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <input className="input" placeholder="Description *" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
          <input className="input" placeholder="SKU" value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} />
          <input className="input" placeholder="Unit (UOM)" value={newProduct.uom} onChange={e => setNewProduct({ ...newProduct, uom: e.target.value })} />
          <input className="input" placeholder="Price" type="number" value={newProduct.sell_price} onChange={e => setNewProduct({ ...newProduct, sell_price: e.target.value })} />
          <input className="input" placeholder="Lead Time (days)" type="number" value={newProduct.lead_time_days} onChange={e => setNewProduct({ ...newProduct, lead_time_days: e.target.value })} />
        </div>
        <button onClick={addProduct} className="flex items-center gap-2 text-sm bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-2xl mb-6">
          <Plus className="w-4 h-4" /> Add Product
        </button>

        {/* Products List */}
        {products.length > 0 && (
          <div className="space-y-3">
            {products.map((product, index) => (
              <div key={index} className="flex justify-between items-center bg-neutral-50 p-4 rounded-2xl">
                <div>
                  <span className="font-medium">{product.description}</span>
                  {product.sku && <span className="text-sm text-neutral-500 ml-2">({product.sku})</span>}
                </div>
                <button onClick={() => deleteProduct(product.id)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== SERVICES ==================== */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <h2 className="font-semibold text-xl mb-6">Services You Offer</h2>

        <div className="flex gap-3 mb-6">
          <input
            className="input flex-1"
            placeholder="e.g. Logistics, Warehousing, Custom Packaging"
            value={newService}
            onChange={e => setNewService(e.target.value)}
          />
          <button onClick={addService} className="btn-primary px-6">Add</button>
        </div>

        {services.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {services.map((service, index) => (
              <div key={index} className="flex items-center gap-2 bg-neutral-100 px-4 py-2 rounded-2xl">
                {service}
                <button onClick={() => deleteService(index)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-3 px-10 py-3.5 text-lg">
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}