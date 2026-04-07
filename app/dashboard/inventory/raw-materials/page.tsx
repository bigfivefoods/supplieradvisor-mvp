'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Search, Plus, ShoppingCart, Truck, QrCode, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface RawMaterial {
  id: number;
  name: string;
  sku: string;
  description: string;
  category: string;
  uom: string;
  reorderLevel: number;
  costPrice: number;
  supplier: string;
  originCountry: string;
  shelfLifeDays: number;
  allergens: string;
  storageConditions: string;
  hazardClass: string;
  imageUrl: string;
  msdsUrl: string;
  notes: string;
}

export default function RawMaterials() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterial | null>(null);
  const [selectedItem, setSelectedItem] = useState<RawMaterial | null>(null);

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([
    {
      id: 1,
      name: 'Wheat Flour',
      sku: 'RM-001',
      description: 'High-grade bread flour',
      category: 'Grains',
      uom: 'kg',
      reorderLevel: 2000,
      costPrice: 12.50,
      supplier: 'Golden Fields',
      originCountry: 'South Africa',
      shelfLifeDays: 365,
      allergens: 'Gluten',
      storageConditions: 'Cool & dry',
      hazardClass: 'None',
      imageUrl: '',
      msdsUrl: '',
      notes: ''
    }
  ]);

  const filtered = rawMaterials.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = (item: RawMaterial | null = null) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const deleteItem = (id: number) => {
    if (confirm('Delete this raw material permanently?')) {
      setRawMaterials(prev => prev.filter(i => i.id !== id));
      toast.success('Raw material deleted');
    }
  };

  const saveItem = (newItem: RawMaterial) => {
    if (editingItem) {
      setRawMaterials(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...newItem } : i));
      toast.success('Raw material updated');
    } else {
      setRawMaterials(prev => [...prev, { ...newItem, id: Date.now() }]);
      toast.success('Raw material created');
    }
    setShowModal(false);
    setEditingItem(null);
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Raw Materials</h1>
          <p className="text-xl text-neutral-600">Create • Edit • Delete • Purchase • Transfer • Traceability</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-3 px-8 py-4">
          <Plus size={20} /> Create Raw Material
        </button>
      </div>

      <div className="flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 text-neutral-400" size={20} />
          <input type="text" placeholder="Search raw materials..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input pl-11 w-full" />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="px-8 py-5 text-left font-medium">Item</th>
              <th className="px-8 py-5 text-left font-medium">SKU</th>
              <th className="px-8 py-5 text-left font-medium">Stock</th>
              <th className="px-8 py-5 text-left font-medium">Unit</th>
              <th className="px-8 py-5 text-left font-medium">Supplier</th>
              <th className="px-8 py-5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="border-b last:border-none hover:bg-neutral-50">
                <td className="px-8 py-6 font-medium">{item.name}</td>
                <td className="px-8 py-6 text-neutral-500">{item.sku}</td>
                <td className="px-8 py-6 font-medium">0</td>
                <td className="px-8 py-6 text-neutral-500">{item.uom}</td>
                <td className="px-8 py-6 text-neutral-600">{item.supplier}</td>
                <td className="px-8 py-6 text-right space-x-2">
                  <button onClick={() => openModal(item)} className="border px-5 py-2 text-sm rounded-3xl hover:bg-neutral-50 flex items-center gap-2">
                    <Edit size={16} /> Edit
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="border px-5 py-2 text-sm rounded-3xl hover:bg-neutral-50 text-red-600 flex items-center gap-2">
                    <Trash2 size={16} /> Delete
                  </button>
                  <button onClick={() => toast.success('Purchase Order modal would open here')} className="btn-primary text-sm px-5 py-2">Purchase</button>
                  <button onClick={() => { setSelectedItem(item); setShowTransferModal(true); }} className="border px-5 py-2 text-sm rounded-3xl hover:bg-neutral-50">Transfer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal (identical functionality) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-8 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
              <h2 className="text-3xl font-bold">{editingItem ? 'Edit Raw Material' : 'Create Raw Material'}</h2>
              <button onClick={() => setShowModal(false)} className="text-3xl leading-none">×</button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Material Name</label>
                  <input type="text" className="input w-full" defaultValue={editingItem?.name} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">SKU</label>
                  <input type="text" className="input w-full" defaultValue={editingItem?.sku} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea className="input w-full h-24" defaultValue={editingItem?.description} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select className="input w-full" defaultValue={editingItem?.category}>
                    <option>Grains</option><option>Oils</option><option>Spices</option><option>Sweeteners</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">UoM</label>
                  <select className="input w-full" defaultValue={editingItem?.uom}>
                    <option>Kg</option><option>L</option><option>Tonne</option><option>Piece</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Reorder Level</label>
                  <input type="number" className="input w-full" defaultValue={editingItem?.reorderLevel} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Cost Price (per unit)</label>
                  <input type="number" className="input w-full" defaultValue={editingItem?.costPrice} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Preferred Supplier</label>
                  <input type="text" className="input w-full" defaultValue={editingItem?.supplier} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Country of Origin</label>
                  <input type="text" className="input w-full" defaultValue={editingItem?.originCountry} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Shelf Life (days)</label>
                  <input type="number" className="input w-full" defaultValue={editingItem?.shelfLifeDays} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Allergens</label>
                  <input type="text" className="input w-full" defaultValue={editingItem?.allergens} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Storage Conditions</label>
                  <input type="text" className="input w-full" defaultValue={editingItem?.storageConditions} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Hazard Class</label>
                  <input type="text" className="input w-full" defaultValue={editingItem?.hazardClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Image</label>
                <input type="file" className="input w-full" accept="image/*" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">MSDS / COA Document</label>
                <input type="file" className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea className="input w-full h-24" defaultValue={editingItem?.notes} />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setShowModal(false)} className="flex-1 border py-4 rounded-3xl">Cancel</button>
                <button onClick={() => saveItem({
                  id: editingItem ? editingItem.id : Date.now(),
                  name: 'Test Raw Material',
                  sku: 'RM-999',
                  description: '',
                  category: '',
                  uom: 'kg',
                  reorderLevel: 0,
                  costPrice: 0,
                  supplier: '',
                  originCountry: '',
                  shelfLifeDays: 0,
                  allergens: '',
                  storageConditions: '',
                  hazardClass: '',
                  imageUrl: '',
                  msdsUrl: '',
                  notes: ''
                })} className="flex-1 btn-primary py-4">
                  {editingItem ? 'Update Raw Material' : 'Create Raw Material'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center">
          <div className="bg-white rounded-3xl w-full max-w-lg mx-4 p-8">
            <h2 className="text-3xl font-bold mb-8">Transfer {selectedItem.name}</h2>
            <div className="mb-6">
              <label className="block text-sm mb-2">Destination Type</label>
              <select className="input w-full">
                <option value="warehouse">Our Warehouse / Site</option>
                <option value="supplier">Connected Supplier (and their site)</option>
                <option value="customer">Connected Customer (and their site)</option>
              </select>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowTransferModal(false)} className="flex-1 border py-4 rounded-3xl">Cancel</button>
              <button onClick={() => { setShowTransferModal(false); setShowQRModal(true); }} className="flex-1 btn-primary py-4">Transfer + Generate QR</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center">
          <div className="bg-white rounded-3xl w-full max-w-md mx-4 p-8 text-center">
            <h2 className="text-2xl font-bold mb-6">On-Chain Traceability QR</h2>
            <div className="mx-auto w-48 h-48 bg-neutral-100 rounded-3xl flex items-center justify-center text-8xl mb-6">📱</div>
            <p className="text-neutral-500">Scan to view full traceability on blockchain</p>
            <button onClick={() => setShowQRModal(false)} className="mt-8 btn-primary w-full py-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}