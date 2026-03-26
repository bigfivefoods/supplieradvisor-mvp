'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function InventoryTransfer() {
  const [transferType, setTransferType] = useState<'internal' | 'external'>('internal')

  const [form, setForm] = useState({
    itemType: 'Raw Materials',
    fromLocationId: 1,
    toLocationId: 101,
    approximateDistance: '',           // ← NEW FIELD
    notes: '',
    // Internal fields
    pickupDate: '',
    pickupTime: '',
    driverName: '',
    vehicleReg: '',
    estimatedDeliveryDate: '',
    estimatedDeliveryTime: '',
    // External fields
    providerId: 1,
    serviceLevel: 'Standard',
    costEstimate: '',
    trackingNumber: ''
  })

  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([])
  const [quantities, setQuantities] = useState<Record<number, string>>({})

  // Mock items
  const rawMaterials = [
    { id: 1, name: 'Tomato Paste 1kg', uom: 'kg' },
    { id: 2, name: 'Fresh Chicken 2kg', uom: 'kg' },
    { id: 3, name: 'Rice 5kg', uom: 'kg' },
  ]

  const finishedGoods = [
    { id: 101, name: 'Pasta Sauce Jar', uom: 'Jar' },
    { id: 102, name: 'Ready Meal Pack', uom: 'Pack' },
  ]

  const selectedItemsList = form.itemType === 'Raw Materials' ? rawMaterials : finishedGoods

  // Combined locations with stock
  const allLocations = [
    { id: 1, name: 'Durban Main', type: 'Warehouse', stock: {1: 1240, 2: 890, 3: 2450, 101: 560, 102: 320} },
    { id: 2, name: 'Pietermaritzburg', type: 'Warehouse', stock: {1: 450, 2: 320, 3: 980, 101: 180, 102: 90} },
    { id: 101, name: 'C-DUR-001', type: 'Container', stock: {1: 800, 2: 500, 3: 1200, 101: 300, 102: 150} },
    { id: 102, name: 'C-DUR-002 (Cold Room)', type: 'Container', stock: {1: 200, 2: 150, 3: 400, 101: 80, 102: 60} },
    { id: 201, name: 'C-PMB-001', type: 'Container', stock: {1: 300, 2: 250, 3: 600, 101: 120, 102: 80} },
  ]

  const fromLocation = allLocations.find(l => l.id === form.fromLocationId)
  const availableItems = selectedItemsList.filter(item => (fromLocation?(.stock as Record<number, number>)[item.id] ?? 0) > 0)

  const toLocations = allLocations.filter(l => l.id !== form.fromLocationId)

  // Mock Logistics data
  const vehicles = [
    { id: 1, reg: 'ND 123 456', driver: 'John Mthembu', type: 'Refrigerated Truck' },
    { id: 2, reg: 'ND 789 012', driver: 'Sizwe Nkosi', type: 'Box Truck' },
  ]

  const externalProviders = [
    { id: 1, name: 'DHL Supply Chain', serviceLevels: ['Standard', 'Express', 'Premium'] },
    { id: 2, name: 'Imperial Logistics', serviceLevels: ['Standard', 'Express'] },
    { id: 3, name: 'Bidvest Freight', serviceLevels: ['Standard', 'Premium'] },
  ]

  // Auto-clean selected items when From changes
  useEffect(() => {
    const validIds = selectedItemIds.filter(id => (fromLocation?.stock[id] || 0) > 0)
    if (validIds.length !== selectedItemIds.length) {
      setSelectedItemIds(validIds)
      const newQuantities = { ...quantities }
      selectedItemIds.forEach(id => {
        if (!validIds.includes(id)) delete newQuantities[id]
      })
      setQuantities(newQuantities)
    }
  }, [form.fromLocationId])

  const toggleItem = (id: number) => {
    if (selectedItemIds.includes(id)) {
      setSelectedItemIds(selectedItemIds.filter(itemId => itemId !== id))
      const newQuantities = { ...quantities }
      delete newQuantities[id]
      setQuantities(newQuantities)
    } else {
      setSelectedItemIds([...selectedItemIds, id])
    }
  }

  const updateQuantity = (id: number, value: string) => {
    setQuantities({ ...quantities, [id]: value })
  }

  const handleTransfer = () => {
    if (selectedItemIds.length === 0) {
      alert('Please select at least one item')
      return
    }

    let valid = true
    selectedItemIds.forEach(id => {
      const qty = Number(quantities[id] || 0)
      const available = fromLocation?.stock[id] || 0
      if (qty <= 0 || qty > available) valid = false
    })

    if (!valid) {
      alert('One or more quantities are invalid or exceed available stock')
      return
    }

    const fromName = fromLocation?.name || ''
    const toName = allLocations.find(l => l.id === form.toLocationId)?.name || ''

    alert(`✅ ${transferType === 'internal' ? 'Internal' : 'External'} transfer successful!\n\nItems: ${selectedItemIds.length}\nFrom: ${fromName}\nTo: ${toName}\nApproximate Distance: ${form.approximateDistance || '0'} km\nNotes: ${form.notes || 'None'}`)

    setSelectedItemIds([])
    setQuantities({})
    setForm({ ...form, notes: '', approximateDistance: '' })
  }

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/inventory" style={{ color: '#10b981', textDecoration: 'none' }}>← Back to Inventory</Link>
        <span style={{ color: '#aaa' }}>/ Transfer Inventory</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '30px' }}>
        New Transfer
      </h3>

      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '60px', borderRadius: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

          {/* TRANSFER TYPE TOGGLE */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', background: '#111', borderRadius: '999px', padding: '6px', width: 'fit-content', marginBottom: '30px' }}>
            <button onClick={() => setTransferType('internal')} style={{ padding: '12px 32px', borderRadius: '999px', background: transferType === 'internal' ? '#10b981' : 'transparent', color: transferType === 'internal' ? '#000' : '#fff', fontWeight: 'bold' }}>
              Internal Transfer
            </button>
            <button onClick={() => setTransferType('external')} style={{ padding: '12px 32px', borderRadius: '999px', background: transferType === 'external' ? '#10b981' : 'transparent', color: transferType === 'external' ? '#000' : '#fff', fontWeight: 'bold' }}>
              External Transfer
            </button>
          </div>

          {/* FROM LOCATION */}
          <div>
            <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>From Warehouse or Container</label>
            <select value={form.fromLocationId} onChange={e => setForm({ ...form, fromLocationId: Number(e.target.value) })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }}>
              {allLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
              ))}
            </select>
          </div>

          {/* SELECT ITEMS + QUANTITY TABLE */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: '#aaa', display: 'block', marginBottom: '12px' }}>Select Items & Quantity to Transfer</label>
            <div style={{ background: '#1a1a1a', borderRadius: '16px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #222' }}>
                    <th style={{ textAlign: 'left', padding: '16px', color: '#aaa' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '16px', color: '#aaa' }}>Available</th>
                    <th style={{ textAlign: 'center', padding: '16px', color: '#aaa' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {availableItems.map(item => {
                    const available = fromLocation?(.stock as Record<number, number>)[item.id] ?? 0
                    const isSelected = selectedItemIds.includes(item.id)
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                        <td style={{ padding: '16px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleItem(item.id)} />
                            <span style={{ color: '#fff' }}>{item.name}</span>
                          </label>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>
                          {available} {item.uom}
                        </td>
                        <td style={{ padding: '16px' }}>
                          {isSelected ? (
                            <input 
                              type="number" 
                              value={quantities[item.id] || ''} 
                              onChange={e => updateQuantity(item.id, e.target.value)} 
                              max={available}
                              style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '8px', color: '#fff', textAlign: 'center' }} 
                            />
                          ) : (
                            <span style={{ color: '#555' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TRANSFER TO */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Transfer To (Warehouse or Container)</label>
            <select value={form.toLocationId} onChange={e => setForm({ ...form, toLocationId: Number(e.target.value) })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }}>
              {toLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
              ))}
            </select>
          </div>

          {/* NEW: APPROXIMATE DISTANCE */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Approximate Distance (km) between Collection & Delivery</label>
            <input 
              type="number" 
              placeholder="e.g. 245" 
              value={form.approximateDistance} 
              onChange={e => setForm({ ...form, approximateDistance: e.target.value })}
              style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} 
            />
            <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>Distance in kilometres (you can auto-calculate this later with Google Maps if needed)</p>
          </div>

          {/* INTERNAL FIELDS — Calendar + Clock */}
          {transferType === 'internal' && (
            <>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Pickup Date</label>
                <input type="date" value={form.pickupDate} onChange={e => setForm({ ...form, pickupDate: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Pickup Time</label>
                <input type="time" value={form.pickupTime} onChange={e => setForm({ ...form, pickupTime: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
              </div>

              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Driver Name</label>
                <input value={form.driverName} onChange={e => setForm({ ...form, driverName: e.target.value })} placeholder="Driver name" style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Vehicle Registration</label>
                <input value={form.vehicleReg} onChange={e => setForm({ ...form, vehicleReg: e.target.value })} placeholder="ND 123 456" style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
              </div>

              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Estimated Delivery Date</label>
                <input type="date" value={form.estimatedDeliveryDate} onChange={e => setForm({ ...form, estimatedDeliveryDate: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Estimated Delivery Time</label>
                <input type="time" value={form.estimatedDeliveryTime} onChange={e => setForm({ ...form, estimatedDeliveryTime: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
              </div>
            </>
          )}

          {/* EXTERNAL FIELDS */}
          {transferType === 'external' && (
            <>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>External Service Provider</label>
                <select value={form.providerId} onChange={e => setForm({ ...form, providerId: Number(e.target.value) })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }}>
                  {externalProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Service Level</label>
                <select value={form.serviceLevel} onChange={e => setForm({ ...form, serviceLevel: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }}>
                  <option>Standard</option>
                  <option>Express</option>
                  <option>Premium</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Estimated Cost (R)</label>
                <input type="number" value={form.costEstimate} onChange={e => setForm({ ...form, costEstimate: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} placeholder="1250" />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Tracking Number (optional)</label>
                <input value={form.trackingNumber} onChange={e => setForm({ ...form, trackingNumber: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} placeholder="TRK-987654" />
              </div>
            </>
          )}

          {/* NOTES */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. For production line 3" style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', minHeight: '100px', fontSize: '16px' }} />
          </div>
        </div>

        <button onClick={handleTransfer} style={{ marginTop: '50px', width: '100%', background: '#10b981', color: '#000', padding: '24px', borderRadius: '14px', fontSize: '20px', fontWeight: 'bold' }}>
          ✅ Confirm {transferType === 'internal' ? 'Internal' : 'External'} Transfer
        </button>
      </div>
    </div>
  )
}