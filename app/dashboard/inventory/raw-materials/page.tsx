'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function RawMaterials() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    uom: 'kg',
    primarySupplier: '',
    costPerUom: '',
    defaultWarehouse: '',
    reorderLevel: '',
    safetyStock: '',
    leadTimeDays: '',
    storageConditions: '',
    notes: '',
    image: null as File | null,
  })
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [rawMaterials, setRawMaterials] = useState([
    { id: 1, sku: 'RM-TOM-001', name: 'Tomato Paste', description: 'Concentrated tomato paste', category: 'Ingredients', quantity: 12450, uom: 'kg', primarySupplier: 'BigFive Foods', costPerUom: 45.50, defaultWarehouse: 'Durban Main', reorderLevel: 2000, safetyStock: 500, leadTimeDays: 5, storageConditions: 'Cool, dry place', notes: 'High volume', value: 562500, status: 'In Stock', lastUpdated: '2026-03-21 09:15' },
    { id: 2, sku: 'RM-CHI-002', name: 'Fresh Chicken Breast', description: 'Boneless chicken breast', category: 'Meat', quantity: 8750, uom: 'kg', primarySupplier: 'KZN Fresh Produce', costPerUom: 68.00, defaultWarehouse: 'Pietermaritzburg', reorderLevel: 1500, safetyStock: 300, leadTimeDays: 3, storageConditions: 'Refrigerated 0-4°C', notes: 'Perishable', value: 596250, status: 'Low Stock', lastUpdated: '2026-03-21 08:45' },
  ])

  const suppliers = ['BigFive Foods', 'KZN Fresh Produce', 'Cape Agri Supply']
  const warehouses = ['Durban Main', 'Pietermaritzburg', 'Cape Town']

  const filtered = rawMaterials.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.sku.toLowerCase().includes(search.toLowerCase())
  )

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setNewItem({ ...newItem, image: file })
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const addRawMaterial = () => {
    if (!newItem.sku || !newItem.name || !newItem.primarySupplier || !newItem.defaultWarehouse) {
      alert('Please fill required fields: SKU, Name, Primary Supplier, Default Warehouse')
      return
    }

    const cost = parseFloat(newItem.costPerUom) || 0
    const qty = 0
    const value = cost * qty

    const newEntry = {
      id: Date.now(),
      sku: newItem.sku,
      name: newItem.name,
      description: newItem.description,
      category: newItem.category,
      quantity: qty,
      uom: newItem.uom,
      primarySupplier: newItem.primarySupplier,
      costPerUom: cost,
      defaultWarehouse: newItem.defaultWarehouse,
      reorderLevel: parseInt(newItem.reorderLevel) || 0,
      safetyStock: parseInt(newItem.safetyStock) || 0,
      leadTimeDays: parseInt(newItem.leadTimeDays) || 0,
      storageConditions: newItem.storageConditions,
      notes: newItem.notes,
      value: value,
      status: 'New',
      lastUpdated: new Date().toLocaleString('en-ZA')
    }

    setRawMaterials([newEntry, ...rawMaterials])
    alert('✅ Raw Material added successfully!')

    setShowAdd(false)
    setNewItem({
      sku: '', name: '', description: '', category: '', uom: 'kg', primarySupplier: '',
      costPerUom: '', defaultWarehouse: '', reorderLevel: '', safetyStock: '',
      leadTimeDays: '', storageConditions: '', notes: '', image: null
    })
    setImagePreview(null)
  }

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/inventory" style={{ color: '#10b981', textDecoration: 'none' }}>← Back to Inventory</Link>
        <span style={{ color: '#aaa' }}>/ Raw Materials</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '40px' }}>
        Raw Materials
      </h3>

      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <input 
            type="text" 
            placeholder="Search raw materials..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '400px', padding: '16px', background: '#000', borderRadius: '14px', color: '#fff' }}
          />
          <button onClick={() => setShowAdd(true)} style={{ background: '#10b981', color: '#000', padding: '14px 32px', borderRadius: '12px', fontWeight: 'bold' }}>
            + Add Raw Material
          </button>
        </div>

        {/* ADD FORM MODAL — IDENTICAL HEIGHT TO HEADER */}
        {showAdd && (
          <div style={{ 
            position: 'fixed', 
            top: '95px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            background: 'rgba(0,0,0,0.95)', 
            width: '100%', 
            maxHeight: '75vh', 
            overflowY: 'auto', 
            zIndex: 100, 
            padding: '20px' 
          }}>
            <div style={{ background: '#111', padding: '30px', borderRadius: '28px', width: '620px', margin: '0 auto' }}>
              <h4 style={{ color: '#fff', marginBottom: '24px' }}>Add New Raw Material</h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Image (Upload)</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                  {imagePreview && <img src={imagePreview} alt="preview" style={{ width: '100%', marginTop: '12px', borderRadius: '12px' }} />}
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>SKU Number</label>
                  <input value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Name</label>
                  <input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Description</label>
                  <input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Category</label>
                  <input value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>UoM</label>
                  <select value={newItem.uom} onChange={e => setNewItem({...newItem, uom: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                    <option>kg</option><option>pack</option><option>bag</option><option>litre</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Primary Supplier</label>
                  <select value={newItem.primarySupplier} onChange={e => setNewItem({...newItem, primarySupplier: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                    <option value="">Select...</option>
                    {['BigFive Foods', 'KZN Fresh Produce', 'Cape Agri Supply'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Cost per UoM (R)</label>
                  <input type="number" value={newItem.costPerUom} onChange={e => setNewItem({...newItem, costPerUom: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Default Warehouse</label>
                  <select value={newItem.defaultWarehouse} onChange={e => setNewItem({...newItem, defaultWarehouse: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                    <option value="">Select...</option>
                    {['Durban Main', 'Pietermaritzburg', 'Cape Town'].map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Reorder Level</label>
                  <input type="number" value={newItem.reorderLevel} onChange={e => setNewItem({...newItem, reorderLevel: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Safety Stock</label>
                  <input type="number" value={newItem.safetyStock} onChange={e => setNewItem({...newItem, safetyStock: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Lead Time (days)</label>
                  <input type="number" value={newItem.leadTimeDays} onChange={e => setNewItem({...newItem, leadTimeDays: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Storage Conditions</label>
                  <input value={newItem.storageConditions} onChange={e => setNewItem({...newItem, storageConditions: e.target.value})} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Notes</label>
                  <textarea value={newItem.notes} onChange={e => setNewItem({...newItem, notes: e.target.value})} style={{ width: '100%', height: '80px', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                </div>
              </div>

              <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
                <button onClick={addRawMaterial} style={{ flex: 1, background: '#10b981', color: '#000', padding: '18px', borderRadius: '14px', fontWeight: 'bold' }}>Add to Inventory</button>
                <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: '#333', color: '#fff', padding: '18px', borderRadius: '14px' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* TABLE */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '16px', color: '#aaa' }}>SKU</th>
              <th style={{ textAlign: 'left', padding: '16px', color: '#aaa' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '16px', color: '#aaa' }}>Quantity</th>
              <th style={{ textAlign: 'center', padding: '16px', color: '#aaa' }}>UOM</th>
              <th style={{ textAlign: 'left', padding: '16px', color: '#aaa' }}>Warehouse</th>
              <th style={{ textAlign: 'right', padding: '16px', color: '#aaa' }}>Value</th>
              <th style={{ textAlign: 'center', padding: '16px', color: '#aaa' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '20px', color: '#fff' }}>{item.sku}</td>
                <td style={{ padding: '20px', color: '#fff' }}>{item.name}</td>
                <td style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>{item.quantity.toLocaleString()}</td>
                <td style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>{item.uom}</td>
                <td style={{ padding: '20px', color: '#aaa' }}>{item.defaultWarehouse}</td>
                <td style={{ padding: '20px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>
                  R{(item.value || 0).toLocaleString()}
                </td>
                <td style={{ padding: '20px', textAlign: 'center' }}>
                  <span style={{ padding: '6px 16px', borderRadius: '999px', background: item.status === 'In Stock' ? '#10b98133' : '#f59e0b33', color: item.status === 'In Stock' ? '#10b981' : '#f59e0b' }}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}