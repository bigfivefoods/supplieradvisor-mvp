'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Warehouses() {
  const [searchWarehouse, setSearchWarehouse] = useState('')
  const [searchContainer, setSearchContainer] = useState('')
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [showContainerModal, setShowContainerModal] = useState(false)

  const [editingWarehouse, setEditingWarehouse] = useState<any>(null)
  const [editingContainer, setEditingContainer] = useState<any>(null)

  // Warehouses
  const [warehouses, setWarehouses] = useState([
    { id: 1, name: 'Durban Main', physicalAddress: '123 Port Road, Durban, 4001', email: 'durban@bigfivefoods.co.za', gpsLat: -29.8587, gpsLong: 31.0218, capacityM3: 12500, status: 'Active', manager: 'Sipho Nkosi', phone: '082 345 6789', lastAudit: '2026-03-15' },
    { id: 2, name: 'Pietermaritzburg', physicalAddress: '45 Church Street, Pietermaritzburg, 3201', email: 'pmb@bigfivefoods.co.za', gpsLat: -29.6000, gpsLong: 30.3833, capacityM3: 8200, status: 'Active', manager: 'Thandiwe Mthembu', phone: '083 456 7890', lastAudit: '2026-03-10' },
  ])

  // Containers
  const [containers, setContainers] = useState([
    { id: 101, containerId: 'C-DUR-001', type: 'Pallet Racking', capacityPallets: 450, gpsLat: -29.8587, gpsLong: 31.0218, tempControlled: true, email: 'container1@durban.warehouse.co.za', physicalAddress: '123 Port Road, Durban, 4001', currentValue: 2450000, assignedWarehouse: 'Durban Main', manager: 'Sipho Nkosi' },
    { id: 102, containerId: 'C-PMB-002', type: 'Cold Room', capacityPallets: 120, gpsLat: -29.6001, gpsLong: 30.3834, tempControlled: true, email: 'coldroom@pmb.warehouse.co.za', physicalAddress: '45 Church Street, Pietermaritzburg, 3201', currentValue: 890000, assignedWarehouse: 'Pietermaritzburg', manager: 'Thandiwe Mthembu' },
  ])

  const filteredWarehouses = warehouses.filter(w =>
    w.name.toLowerCase().includes(searchWarehouse.toLowerCase()) ||
    w.physicalAddress.toLowerCase().includes(searchWarehouse.toLowerCase())
  )

  const filteredContainers = containers.filter(c =>
    c.containerId.toLowerCase().includes(searchContainer.toLowerCase()) ||
    c.physicalAddress.toLowerCase().includes(searchContainer.toLowerCase())
  )

  // Warehouse Form
  const [warehouseForm, setWarehouseForm] = useState({
    name: '', physicalAddress: '', email: '', gpsLat: '', gpsLong: '', capacityM3: '', manager: '', phone: ''
  })

  const openWarehouseModal = (warehouse?: any) => {
    if (warehouse) {
      setWarehouseForm({
        name: warehouse.name,
        physicalAddress: warehouse.physicalAddress,
        email: warehouse.email,
        gpsLat: warehouse.gpsLat.toString(),
        gpsLong: warehouse.gpsLong.toString(),
        capacityM3: warehouse.capacityM3.toString(),
        manager: warehouse.manager,
        phone: warehouse.phone
      })
      setEditingWarehouse(warehouse)
    } else {
      setWarehouseForm({ name: '', physicalAddress: '', email: '', gpsLat: '', gpsLong: '', capacityM3: '', manager: '', phone: '' })
      setEditingWarehouse(null)
    }
    setShowWarehouseModal(true)
  }

  const saveWarehouse = () => {
    if (!warehouseForm.name || !warehouseForm.physicalAddress) return
    const newData = {
      ...warehouseForm,
      id: editingWarehouse ? editingWarehouse.id : Date.now(),
      gpsLat: parseFloat(warehouseForm.gpsLat) || 0,
      gpsLong: parseFloat(warehouseForm.gpsLong) || 0,
      capacityM3: parseInt(warehouseForm.capacityM3) || 0,
      status: 'Active',
      lastAudit: new Date().toISOString().split('T')[0]
    }
    if (editingWarehouse) {
      setWarehouses(warehouses.map(w => w.id === editingWarehouse.id ? newData : w))
    } else {
      setWarehouses([...warehouses, newData])
    }
    setShowWarehouseModal(false)
    setEditingWarehouse(null)
  }

  // Container Form (includes Manager + new Sales/DC types)
  const [containerForm, setContainerForm] = useState({
    containerId: '', type: 'Pallet Racking', capacityPallets: '', gpsLat: '', gpsLong: '', tempControlled: false, email: '', physicalAddress: '', assignedWarehouse: '', manager: ''
  })

  const openContainerModal = (container?: any) => {
    if (container) {
      setContainerForm({
        containerId: container.containerId,
        type: container.type,
        capacityPallets: container.capacityPallets.toString(),
        gpsLat: container.gpsLat.toString(),
        gpsLong: container.gpsLong.toString(),
        tempControlled: container.tempControlled,
        email: container.email,
        physicalAddress: container.physicalAddress,
        assignedWarehouse: container.assignedWarehouse,
        manager: container.manager || ''
      })
      setEditingContainer(container)
    } else {
      setContainerForm({ containerId: '', type: 'Pallet Racking', capacityPallets: '', gpsLat: '', gpsLong: '', tempControlled: false, email: '', physicalAddress: '', assignedWarehouse: '', manager: '' })
      setEditingContainer(null)
    }
    setShowContainerModal(true)
  }

  const saveContainer = () => {
    if (!containerForm.containerId) return
    const newData = {
      ...containerForm,
      id: editingContainer ? editingContainer.id : Date.now(),
      capacityPallets: parseInt(containerForm.capacityPallets) || 0,
      gpsLat: parseFloat(containerForm.gpsLat) || 0,
      gpsLong: parseFloat(containerForm.gpsLong) || 0,
      currentValue: editingContainer ? editingContainer.currentValue : 0
    }
    if (editingContainer) {
      setContainers(containers.map(c => c.id === editingContainer.id ? newData : c))
    } else {
      setContainers([...containers, newData])
    }
    setShowContainerModal(false)
    setEditingContainer(null)
  }

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/inventory" style={{ color: '#10b981', textDecoration: 'none' }}>← Back to Inventory</Link>
        <span style={{ color: '#aaa' }}>/ Warehouses & Containers</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '40px' }}>
        Warehouses & Containers
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

        {/* WAREHOUSES CARD */}
        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h4 style={{ color: '#fff' }}>Warehouses</h4>
            <button onClick={() => openWarehouseModal()} style={{ background: '#10b981', color: '#000', padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold' }}>
              + Add Warehouse
            </button>
          </div>
          <input type="text" placeholder="Search warehouses..." value={searchWarehouse} onChange={e => setSearchWarehouse(e.target.value)} style={{ width: '100%', padding: '14px', background: '#000', borderRadius: '12px', color: '#fff', marginBottom: '20px' }} />
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <th style={{ textAlign: 'left', padding: '12px', color: '#aaa' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#aaa' }}>Address</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#aaa' }}>GPS</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#aaa' }}>Capacity (m³)</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#aaa' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWarehouses.map(w => (
                <tr key={w.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '16px', color: '#fff', fontWeight: 'bold' }}>{w.name}</td>
                  <td style={{ padding: '16px', color: '#aaa' }}>{w.physicalAddress}</td>
                  <td style={{ padding: '16px', textAlign: 'center', color: '#10b981', fontSize: '13px' }}>{w.gpsLat.toFixed(4)}, {w.gpsLong.toFixed(4)}</td>
                  <td style={{ padding: '16px', textAlign: 'center', color: '#fff' }}>{w.capacityM3.toLocaleString()}</td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button onClick={() => openWarehouseModal(w)} style={{ background: '#333', color: '#fff', padding: '6px 14px', borderRadius: '8px', fontSize: '13px' }}>
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CONTAINERS CARD */}
        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h4 style={{ color: '#fff' }}>Containers</h4>
            <button onClick={() => openContainerModal()} style={{ background: '#10b981', color: '#000', padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold' }}>
              + Add Container
            </button>
          </div>
          <input type="text" placeholder="Search containers..." value={searchContainer} onChange={e => setSearchContainer(e.target.value)} style={{ width: '100%', padding: '14px', background: '#000', borderRadius: '12px', color: '#fff', marginBottom: '20px' }} />
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <th style={{ textAlign: 'left', padding: '12px', color: '#aaa' }}>Container ID</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#aaa' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#aaa' }}>Address</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#aaa' }}>GPS</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#aaa' }}>Value</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#aaa' }}>Manager</th>
                <th style={{ textAlign: 'center', padding: '12px', color: '#aaa' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContainers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '16px', color: '#fff', fontWeight: 'bold' }}>{c.containerId}</td>
                  <td style={{ padding: '16px', color: '#fff' }}>{c.type}</td>
                  <td style={{ padding: '16px', color: '#aaa' }}>{c.physicalAddress}</td>
                  <td style={{ padding: '16px', textAlign: 'center', color: '#10b981', fontSize: '13px' }}>{c.gpsLat.toFixed(4)}, {c.gpsLong.toFixed(4)}</td>
                  <td style={{ padding: '16px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>R{c.currentValue.toLocaleString()}</td>
                  <td style={{ padding: '16px', color: '#fff' }}>{c.manager || '—'}</td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button onClick={() => openContainerModal(c)} style={{ background: '#333', color: '#fff', padding: '6px 14px', borderRadius: '8px', fontSize: '13px' }}>
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* WAREHOUSE MODAL */}
      {showWarehouseModal && (
        <div style={{ position: 'fixed', top: '95px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.95)', width: '100%', maxHeight: '75vh', overflowY: 'auto', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#111', padding: '30px', borderRadius: '28px', width: '620px', margin: '0 auto' }}>
            <h4 style={{ color: '#fff', marginBottom: '24px' }}>{editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <input placeholder="Warehouse Name" value={warehouseForm.name} onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input placeholder="Physical Address" value={warehouseForm.physicalAddress} onChange={e => setWarehouseForm({...warehouseForm, physicalAddress: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input placeholder="Email Address" value={warehouseForm.email} onChange={e => setWarehouseForm({...warehouseForm, email: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input type="number" step="0.0001" placeholder="GPS Latitude" value={warehouseForm.gpsLat} onChange={e => setWarehouseForm({...warehouseForm, gpsLat: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input type="number" step="0.0001" placeholder="GPS Longitude" value={warehouseForm.gpsLong} onChange={e => setWarehouseForm({...warehouseForm, gpsLong: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input type="number" placeholder="Capacity (m³)" value={warehouseForm.capacityM3} onChange={e => setWarehouseForm({...warehouseForm, capacityM3: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input placeholder="Manager's Name" value={warehouseForm.manager} onChange={e => setWarehouseForm({...warehouseForm, manager: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input placeholder="Phone" value={warehouseForm.phone} onChange={e => setWarehouseForm({...warehouseForm, phone: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
            </div>
            <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
              <button onClick={saveWarehouse} style={{ flex: 1, background: '#10b981', color: '#000', padding: '18px', borderRadius: '14px', fontWeight: 'bold' }}>
                {editingWarehouse ? 'Save Changes' : 'Add Warehouse'}
              </button>
              <button onClick={() => { setShowWarehouseModal(false); setEditingWarehouse(null) }} style={{ flex: 1, background: '#333', color: '#fff', padding: '18px', borderRadius: '14px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CONTAINER MODAL — Updated dropdown with Sales & DC */}
      {showContainerModal && (
        <div style={{ position: 'fixed', top: '95px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.95)', width: '100%', maxHeight: '75vh', overflowY: 'auto', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#111', padding: '30px', borderRadius: '28px', width: '620px', margin: '0 auto' }}>
            <h4 style={{ color: '#fff', marginBottom: '24px' }}>{editingContainer ? 'Edit Container' : 'Add New Container'}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <input placeholder="Container ID" value={containerForm.containerId} onChange={e => setContainerForm({...containerForm, containerId: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <select value={containerForm.type} onChange={e => setContainerForm({...containerForm, type: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                <option>Pallet Racking</option>
                <option>Cold Room</option>
                <option>Shelf Unit</option>
                <option>Bulk Bin</option>
                <option>Sales</option>
                <option>DC</option>
              </select>
              <input type="number" placeholder="Capacity (pallets)" value={containerForm.capacityPallets} onChange={e => setContainerForm({...containerForm, capacityPallets: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input type="number" step="0.0001" placeholder="GPS Latitude" value={containerForm.gpsLat} onChange={e => setContainerForm({...containerForm, gpsLat: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input type="number" step="0.0001" placeholder="GPS Longitude" value={containerForm.gpsLong} onChange={e => setContainerForm({...containerForm, gpsLong: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input placeholder="Email Address" value={containerForm.email} onChange={e => setContainerForm({...containerForm, email: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input placeholder="Physical Address" value={containerForm.physicalAddress} onChange={e => setContainerForm({...containerForm, physicalAddress: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input placeholder="Manager's Name" value={containerForm.manager} onChange={e => setContainerForm({...containerForm, manager: e.target.value})} style={{ padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', gridColumn: '1 / -1' }}>
                <input type="checkbox" checked={containerForm.tempControlled} onChange={e => setContainerForm({...containerForm, tempControlled: e.target.checked})} />
                Temperature Controlled
              </label>
            </div>
            <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
              <button onClick={saveContainer} style={{ flex: 1, background: '#10b981', color: '#000', padding: '18px', borderRadius: '14px', fontWeight: 'bold' }}>
                {editingContainer ? 'Save Changes' : 'Add Container'}
              </button>
              <button onClick={() => { setShowContainerModal(false); setEditingContainer(null) }} style={{ flex: 1, background: '#333', color: '#fff', padding: '18px', borderRadius: '14px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}