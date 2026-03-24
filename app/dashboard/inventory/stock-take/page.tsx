'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function StockTake() {
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [currentLocation, setCurrentLocation] = useState<any>(null)
  const [stockTakeItems, setStockTakeItems] = useState<any[]>([])

  // Add New Item Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [selectedExistingItemId, setSelectedExistingItemId] = useState('')

  // View History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<any>(null)

  const locations = [
    { id: 1, name: 'Durban Main Warehouse', stock: {1: 1240, 2: 890, 3: 2450, 101: 560, 102: 320} },
    { id: 2, name: 'Pietermaritzburg DC', stock: {1: 450, 2: 320, 3: 980} },
    { id: 101, name: 'C-DUR-001 (Container)', stock: {1: 800, 2: 500, 3: 1200, 101: 300} },
    { id: 102, name: 'C-DUR-002 Cold Room', stock: {1: 200, 2: 150, 3: 400, 102: 60} },
    { id: 201, name: 'C-PMB-001', stock: {101: 120, 102: 80} },
  ]

  const existingItems = [
    { id: 1, name: 'Tomato Paste 1kg', uom: 'kg' },
    { id: 2, name: 'Fresh Chicken 2kg', uom: 'kg' },
    { id: 3, name: 'Rice 5kg', uom: 'kg' },
    { id: 101, name: 'Pasta Sauce Jar', uom: 'Jar' },
    { id: 102, name: 'Ready Meal Pack', uom: 'Pack' },
    { id: 201, name: 'Organic Honey 500g', uom: 'Jar' },
  ]

  // Mock Stock Take History
  const stockTakeHistory = [
    { id: 1, date: '21 Mar 2026', location: 'Durban Main Warehouse', accuracy: '98.7%', itemsCounted: 12 },
    { id: 2, date: '14 Mar 2026', location: 'C-DUR-002 Cold Room', accuracy: '97.2%', itemsCounted: 8 },
    { id: 3, date: '07 Mar 2026', location: 'Pietermaritzburg DC', accuracy: '99.1%', itemsCounted: 15 },
  ]

  const handleLocationChange = (e: any) => {
    const locId = Number(e.target.value)
    setSelectedLocationId(e.target.value)
    
    if (!locId) {
      setCurrentLocation(null)
      setStockTakeItems([])
      return
    }

    const loc = locations.find(l => l.id === locId)
    if (!loc) return

    setCurrentLocation(loc)

    const itemsWithStock = existingItems
      .filter(item => (loc.stock[item.id] || 0) > 0)
      .map(item => ({
        id: item.id,
        name: item.name,
        uom: item.uom,
        systemQty: loc.stock[item.id] || 0,
        physicalQty: '',
        variance: 0,
        status: ''
      }))

    setStockTakeItems(itemsWithStock)
  }

  const addExistingItem = () => {
    if (!selectedExistingItemId) return
    const itemToAdd = existingItems.find(i => i.id === Number(selectedExistingItemId))
    if (!itemToAdd || stockTakeItems.some(item => item.id === itemToAdd.id)) return

    const newItem = {
      id: itemToAdd.id,
      name: itemToAdd.name,
      uom: itemToAdd.uom,
      systemQty: 0,
      physicalQty: '',
      variance: 0,
      status: '🆕 Added'
    }

    setStockTakeItems(prev => [...prev, newItem])
    setSelectedExistingItemId('')
    setShowAddItemModal(false)
  }

  const updatePhysicalQty = (id: number, value: string) => {
    setStockTakeItems(prev => prev.map(item => {
      if (item.id === id) {
        const physical = value === '' ? 0 : Number(value)
        const variance = physical - item.systemQty
        let status = ''
        if (variance === 0) status = '✅ Match'
        else if (variance < 0) status = '🔴 Short'
        else status = '🟢 Over'
        return { ...item, physicalQty: value, variance, status }
      }
      return item
    }))
  }

  const saveStockTake = () => {
    alert(`✅ Stock Take Saved for ${currentLocation?.name}!\n\nItems counted: ${stockTakeItems.length}`)
  }

  const cancelStockTake = () => {
    if (!confirm('Cancel this stock take? All progress will be lost.')) return
    setSelectedLocationId('')
    setCurrentLocation(null)
    setStockTakeItems([])
  }

  const viewHistory = (history: any) => {
    setSelectedHistory(history)
    setShowHistoryModal(true)
  }

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/inventory" style={{ color: '#10b981', textDecoration: 'none', fontSize: '18px' }}>← Back to Inventory</Link>
        <span style={{ color: '#aaa' }}>/ Stock Take</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '50px' }}>
        Stock Take
      </h3>

      {/* ====================== SECTION 1: STOCK TAKE KPIs ====================== */}
      <h4 style={{ fontSize: '24px', color: '#fff', marginBottom: '24px' }}>Stock Take KPIs</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '32px', marginBottom: '70px' }}>
        {/* Card 1: Accuracy */}
        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', border: '1px solid #10b981' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '22px', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>Accuracy</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>98.4%</div>
          <div style={{ color: '#666', fontSize: '16px' }}>Last 30 days</div>
        </div>

        {/* Card 2: Value of variance/s */}
        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', border: '1px solid #ef4444' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>💰</div>
          <div style={{ fontSize: '22px', color: '#ef4444', fontWeight: 'bold', marginBottom: '8px' }}>Value of Variance</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#ef4444' }}>-R 8,450</div>
          <div style={{ color: '#666', fontSize: '16px' }}>Last stock take</div>
        </div>

        {/* Card 3: Next stock take date */}
        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px', textAlign: 'center', border: '1px solid #10b981' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
          <div style={{ fontSize: '22px', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>Next Stock Take</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>05 Apr 2026</div>
          <div style={{ color: '#666', fontSize: '16px' }}>Scheduled</div>
        </div>
      </div>

      {/* ====================== SECTION 2: INITIATE STOCK TAKE ====================== */}
      <h4 style={{ fontSize: '24px', color: '#fff', marginBottom: '24px' }}>Initiate Stock Take</h4>

      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '60px', borderRadius: '28px', marginBottom: '70px' }}>
        <select 
          value={selectedLocationId} 
          onChange={handleLocationChange}
          style={{ width: '100%', padding: '20px', background: '#000', borderRadius: '14px', color: '#fff', fontSize: '18px', marginBottom: '30px' }}
        >
          <option value="">— Choose Warehouse or Container —</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>

        {currentLocation && (
          <>
            <div style={{ marginBottom: '30px' }}>
              <h4 style={{ color: '#fff' }}>Items in {currentLocation.name}</h4>
            </div>

            <div style={{ background: '#1a1a1a', borderRadius: '16px', overflow: 'hidden', marginBottom: '40px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #333' }}>
                    <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>System Qty</th>
                    <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Physical Count</th>
                    <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Variance</th>
                    <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockTakeItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '20px', color: '#fff' }}>{item.name}</td>
                      <td style={{ padding: '20px', textAlign: 'center', color: '#666' }}>{item.systemQty} {item.uom}</td>
                      <td style={{ padding: '20px', textAlign: 'center' }}>
                        <input type="number" value={item.physicalQty} onChange={(e) => updatePhysicalQty(item.id, e.target.value)} style={{ width: '140px', padding: '12px', background: '#000', borderRadius: '10px', color: '#fff', textAlign: 'center', fontSize: '18px' }} placeholder="0" />
                      </td>
                      <td style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: item.variance < 0 ? '#ef4444' : item.variance > 0 ? '#10b981' : '#666' }}>
                        {item.variance !== 0 && (item.variance > 0 ? '+' : '')}{item.variance}
                      </td>
                      <td style={{ padding: '20px', textAlign: 'center' }}>{item.status}</td>
                    </tr>
                  ))}

                  <tr style={{ borderTop: '2px solid #333' }}>
                    <td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>
                      <button onClick={() => setShowAddItemModal(true)} style={{ padding: '14px 32px', background: '#10b981', color: '#000', borderRadius: '12px', fontWeight: 'bold' }}>+ Add New Item</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <button onClick={saveStockTake} style={{ padding: '28px', background: '#10b981', color: '#000', fontSize: '22px', fontWeight: 'bold', borderRadius: '16px' }}>
                ✅ Save Stock Take & Reconcile
              </button>
              <button onClick={cancelStockTake} style={{ padding: '28px', background: '#ef4444', color: '#fff', fontSize: '22px', fontWeight: 'bold', borderRadius: '16px' }}>
                ❌ Cancel Stock Take
              </button>
            </div>
          </>
        )}
      </div>

      {/* ====================== SECTION 3: STOCK TAKE HISTORY ====================== */}
      <h4 style={{ fontSize: '24px', color: '#fff', marginBottom: '24px' }}>Stock Take History</h4>

      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '60px', borderRadius: '28px' }}>
        <div style={{ background: '#1a1a1a', borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Location</th>
                <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Accuracy</th>
                <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Items Counted</th>
                <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {stockTakeHistory.map(record => (
                <tr key={record.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '20px', color: '#fff' }}>{record.date}</td>
                  <td style={{ padding: '20px', color: '#ccc' }}>{record.location}</td>
                  <td style={{ padding: '20px', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>{record.accuracy}</td>
                  <td style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>{record.itemsCounted}</td>
                  <td style={{ padding: '20px', textAlign: 'center' }}>
                    <button onClick={() => viewHistory(record)} style={{ padding: '10px 24px', background: '#333', color: '#fff', borderRadius: '12px', fontSize: '15px' }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW HISTORY MODAL */}
      {showHistoryModal && selectedHistory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', padding: '50px', borderRadius: '28px', width: '700px' }}>
            <h4 style={{ color: '#10b981', marginBottom: '20px' }}>Stock Take Results — {selectedHistory.date}</h4>
            <p style={{ color: '#aaa', marginBottom: '30px' }}>{selectedHistory.location} • Accuracy: {selectedHistory.accuracy}</p>
            <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '16px', color: '#ccc' }}>
              Full variance table, photos, notes, and reconciliation details would appear here in a real system.
            </div>
            <button onClick={() => { setShowHistoryModal(false); setSelectedHistory(null) }} style={{ marginTop: '30px', width: '100%', padding: '20px', background: '#333', color: '#fff', borderRadius: '14px' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}