'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createClient } from '@/utils/supabase/client';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

interface Product {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  uom: string | null;
  sell_price: number | null;
  primary_image_url: string | null;
  short_description: string | null;
  status: string;
}

interface ProductCategory {
  id: number;
  name: string;
}

export default function ProductsPage() {
  const { user } = usePrivy();
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    uom: '',
    sell_price: 0,
    short_description: '',
    status: 'active',
  });

  // ==================== LOAD DATA ====================
  const loadProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('business_users')
      .select('profile_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .single();
    if (data) setCurrentProfileId(data.profile_id);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('product_categories').select('id, name').order('name');
    if (data) setCategories(data);
  };

  const fetchProducts = async () => {
    if (!currentProfileId) return;
    let query = supabase
      .from('products')
      .select('id, name, sku, category, uom, sell_price, primary_image_url, short_description, status')
      .eq('profile_id', currentProfileId)
      .order('created_at', { ascending: false });

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
    }
    if (selectedCategory) {
      query = query.eq('category', selectedCategory);
    }

    const { data } = await query;
    if (data) setProducts(data);
  };

  useEffect(() => {
    loadProfile();
    fetchCategories();
  }, [user?.id]);

  useEffect(() => {
    if (currentProfileId) fetchProducts();
  }, [currentProfileId, searchTerm, selectedCategory]);

  // ==================== OPEN MODAL ====================
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      category: '',
      uom: '',
      sell_price: 0,
      short_description: '',
      status: 'active',
    });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || '',
      category: product.category || '',
      uom: product.uom || '',
      sell_price: product.sell_price || 0,
      short_description: product.short_description || '',
      status: product.status || 'active',
    });
    setShowModal(true);
  };

  // ==================== SAVE PRODUCT ====================
  const handleSaveProduct = async () => {
    if (!currentProfileId || !formData.name) return alert('Product name is required');

    setLoading(true);
    try {
      const payload = {
        profile_id: currentProfileId,
        name: formData.name,
        sku: formData.sku || null,
        category: formData.category || null,
        uom: formData.uom || null,
        sell_price: formData.sell_price || null,
        short_description: formData.short_description || null,
        status: formData.status,
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }

      setShowModal(false);
      fetchProducts();
      alert(editingProduct ? 'Product updated successfully' : 'Product created successfully');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== DELETE PRODUCT ====================
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  };

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12 px-8 max-w-7xl mx-auto">
        <Breadcrumb />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-5xl font-black tracking-[-2px] text-[#00b4d8]">Products</h1>
            <p className="text-neutral-600 mt-1">Manage your product master data</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-6 py-3 bg-[#00b4d8] text-white font-semibold rounded-2xl hover:bg-[#0099b8]"
          >
            <Plus className="w-5 h-5" /> New Product
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-4 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-neutral-200 rounded-2xl focus:border-[#00b4d8]"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 border border-neutral-200 rounded-2xl focus:border-[#00b4d8]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-neutral-600">Product</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-neutral-600">SKU</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-neutral-600">Category</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-neutral-600">UOM</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-neutral-600">Sell Price</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-neutral-600">Status</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {product.primary_image_url ? (
                          <img src={product.primary_image_url} alt="" className="w-12 h-12 rounded-xl object-cover border" />
                        ) : (
                          <div className="w-12 h-12 bg-neutral-100 rounded-xl" />
                        )}
                        <div>
                          <div className="font-semibold">{product.name}</div>
                          {product.short_description && (
                            <div className="text-sm text-neutral-500 line-clamp-1">{product.short_description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{product.sku || '—'}</td>
                    <td className="px-6 py-4 text-sm">{product.category || '—'}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{product.uom || '—'}</td>
                    <td className="px-6 py-4 text-right font-medium">R{product.sell_price?.toLocaleString() || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        product.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(product)} className="p-2 hover:bg-neutral-100 rounded-xl">
                          <Edit2 className="w-4 h-4 text-neutral-600" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 hover:bg-red-50 rounded-xl">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== CREATE / EDIT MODAL ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center px-8 py-6 border-b">
              <h2 className="text-2xl font-bold">{editingProduct ? 'Edit Product' : 'Create New Product'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-6 h-6" /></button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Product Name *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-2xl"
                    placeholder="e.g. Fortified Maize Porridge"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">SKU</label>
                  <input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-2xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-2xl"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Unit of Measure (UOM)</label>
                  <input
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-2xl"
                    placeholder="kg, unit, liter, box..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Sell Price (R)</label>
                  <input
                    type="number"
                    value={formData.sell_price}
                    onChange={(e) => setFormData({ ...formData, sell_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-2xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-2xl"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Short Description</label>
                <textarea
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-2xl h-24"
                  placeholder="Brief description of the product..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-8 py-6 border-t bg-neutral-50 rounded-b-3xl">
              <button onClick={() => setShowModal(false)} className="px-6 py-3 border rounded-2xl">Cancel</button>
              <button
                onClick={handleSaveProduct}
                disabled={loading}
                className="px-8 py-3 bg-[#00b4d8] text-white font-semibold rounded-2xl disabled:bg-neutral-300"
              >
                {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}