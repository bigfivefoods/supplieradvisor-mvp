'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function FleetVehicles() {
  const [showAddFleet, setShowAddFleet] = useState(false)
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [showAddType, setShowAddType] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  const [editingType, setEditingType] = useState<any>(null)

  // Fleets
  const [fleets, setFleets] = useState([
    { id: 1, name: 'Refrigerated Fleet', parkedAddress: '123 Port Road, Durban, 4001', managerName: 'Sipho Nkosi', managerEmail: 'sipho@bigfivefoods.co.za', managerPhone: '082 345 6789', vehicleCount: 4 },
    { id: 2, name: 'Box Truck Fleet', parkedAddress: '45 Church Street, Pietermaritzburg, 3201', managerName: 'Thandiwe Mthembu', managerEmail: 'thandiwe@bigfivefoods.co.za', managerPhone: '083 456 7890', vehicleCount: 3 },
  ])

  // Dynamic Vehicle Types
  const [vehicleTypes, setVehicleTypes] = useState([
    { id: 1, name: 'Refrigerated Truck' },
    { id: 2, name: 'Box Truck' },
    { id: 3, name: 'Flatbed' },
    { id: 4, name: 'Car' },
  ])

  // Vehicles
  const [vehicles, setVehicles] = useState([
    { id: 101, reg: 'ND 123 456', type: 'Refrigerated Truck', status: 'On Road', driver: 'John Mthembu', fleetId: 1, parkedAddress: '123 Port Road, Durban, 4001', mileage: '142340', lastServiceDate: '2026-01-15', serviceIntervalKm: '20000', avgDailyKm: '250' },
    { id: 102, reg: 'ND 789 012', type: 'Box Truck', status: 'Available', driver: 'Sizwe Nkosi', fleetId: 2, parkedAddress: '45 Church Street, Pietermaritzburg, 3201', mileage: '98750', lastServiceDate: '2026-02-20', serviceIntervalKm: '25000', avgDailyKm: '180' },
  ])

  const [newFleet, setNewFleet] = useState({ name: '', parkedAddress: '', managerName: '', managerEmail: '', managerPhone: '' })
  const [newVehicle, setNewVehicle] = useState({ reg: '', type: 'Refrigerated Truck', driver: '', fleetId: 1, parkedAddress: '', mileage: '', lastServiceDate: '', serviceIntervalKm: '20000', avgDailyKm: '200' })
  const [newType, setNewType] = useState({ name: '' })

  // Mock drivers for dropdown
  const driversList = [
    { name: 'John Mthembu' },
    { name: 'Sizwe Nkosi' },
    { name: 'Thandiwe Mthembu' },
    { name: 'Nomsa Khumalo' },
  ]

  const addFleet = () => {
    if (!newFleet.name || !newFleet.parkedAddress) return
    setFleets([...fleets, { id: Date.now(), ...newFleet, vehicleCount: 0 }])
    setNewFleet({ name: '', parkedAddress: '', managerName: '', managerEmail: '', managerPhone: '' })
    setShowAddFleet(false)
  }

  const addOrUpdateVehicle = () => {
    if (!newVehicle.reg || !newVehicle.parkedAddress) return
    if (editingVehicle) {
      setVehicles(vehicles.map(v => v.id === editingVehicle.id ? { ...newVehicle, id: v.id } : v))
    } else {
      setVehicles([...vehicles, { ...newVehicle, id: Date.now(), status: 'Available' }])
    }
    setNewVehicle({ reg: '', type: 'Refrigerated Truck', driver: '', fleetId: 1, parkedAddress: '', mileage: '', lastServiceDate: '', serviceIntervalKm: '20000', avgDailyKm: '200' })
    setEditingVehicle(null)
    setShowAddVehicle(false)
  }

  const addOrUpdateType = () => {
    if (!newType.name) return
    if (editingType) {
      setVehicleTypes(vehicleTypes.map(t => t.id === editingType.id ? { ...t, name: newType.name } : t))
    } else {
      setVehicleTypes([...vehicleTypes, { id: Date.now(), name: newType.name }])
    }
    setNewType({ name: '' })
    setEditingType(null)
    setShowAddType(false)
  }

  const editVehicle = (vehicle: any) => {
    setNewVehicle({ ...vehicle })
    setEditingVehicle(vehicle)
    setShowAddVehicle(true)
  }

  const editType = (type: any) => {
    setNewType({ name: type.name })
    setEditingType(type)
    setShowAddType(true)
  }

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/logistics" style={{ color: '#10b981', textDecoration: 'none' }}>← Back to Logistics</Link>
        <span style={{ color: '#aaa' }}>/ Fleet & Vehicles</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '30px' }}>Fleet & Vehicles</h3>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '30px' }}>
        <button onClick={() => setShowAddFleet(true)} style={{ background: '#10b981', color: '#000', padding: '14px 28px', borderRadius: '12px', fontWeight: 'bold' }}>
          + Add New Fleet
        </button>
        <button onClick={() => setShowAddVehicle(true)} style={{ background: '#10b981', color: '#000', padding: '14px 28px', borderRadius: '12px', fontWeight: 'bold' }}>
          + Add New Vehicle
        </button>
        <button onClick={() => setShowAddType(true)} style={{ background: '#10b981', color: '#000', padding: '14px 28px', borderRadius: '12px', fontWeight: 'bold' }}>
          + Add New Vehicle Type
        </button>
      </div>

      {/* FLEETS SECTION */}
      <h4 style={{ fontSize: '22px', color: '#fff', marginBottom: '16px' }}>Fleets</h4>
      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', borderRadius: '28px', padding: '8px', marginBottom: '50px' }}>
        {fleets.map(fleet => (
          <div key={fleet.id} style={{ padding: '20px', background: '#1a1a1a', borderRadius: '16px', margin: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>{fleet.name}</div>
              <div style={{ color: '#aaa' }}>{fleet.parkedAddress}</div>
              <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                Manager: {fleet.managerName} • {fleet.managerEmail} • {fleet.managerPhone}
              </div>
            </div>
            <div style={{ color: '#10b981', fontWeight: 'bold' }}>{fleet.vehicleCount} vehicles</div>
          </div>
        ))}
      </div>

      {/* VEHICLES SECTION */}
      <h4 style={{ fontSize: '22px', color: '#fff', marginBottom: '16px' }}>Vehicles</h4>
      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', borderRadius: '28px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Registration</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Fleet</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Parked Address</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Driver</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map(v => {
              const fleetName = fleets.find(f => f.id === v.fleetId)?.name || 'Unassigned'
              return (
                <tr key={v.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '20px', color: '#fff', fontWeight: 'bold' }}>{v.reg}</td>
                  <td style={{ padding: '20px', color: '#ccc' }}>{v.type}</td>
                  <td style={{ padding: '20px', color: '#10b981' }}>{fleetName}</td>
                  <td style={{ padding: '20px', color: '#aaa' }}>{v.parkedAddress}</td>
                  <td style={{ padding: '20px', textAlign: 'center' }}>
                    <span style={{ padding: '6px 20px', borderRadius: '999px', background: v.status === 'On Road' ? '#10b98133' : v.status === 'Available' ? '#10b98133' : '#ef444433', color: v.status === 'On Road' ? '#10b981' : v.status === 'Available' ? '#10b981' : '#ef4444' }}>
                      {v.status}
                    </span>
                  </td>
                  <td style={{ padding: '20px', color: '#ccc' }}>{v.driver}</td>
                  <td style={{ padding: '20px', textAlign: 'center' }}>
                    <button onClick={() => editVehicle(v)} style={{ background: '#333', color: '#fff', padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}>✏️ Edit</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ADD NEW FLEET MODAL */}
      {showAddFleet && (
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', padding: '40px', borderRadius: '28px', width: '620px' }}>
            <h4 style={{ color: '#fff', marginBottom: '24px' }}>Add New Fleet</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Fleet Name</label>
                <input placeholder="Fleet Name" value={newFleet.name} onChange={e => setNewFleet({ ...newFleet, name: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Fleet Manager Name</label>
                <input placeholder="Fleet Manager Name" value={newFleet.managerName} onChange={e => setNewFleet({ ...newFleet, managerName: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Manager Email Address</label>
                <input placeholder="Manager Email" value={newFleet.managerEmail} onChange={e => setNewFleet({ ...newFleet, managerEmail: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Manager Contact Number</label>
                <input placeholder="Manager Phone" value={newFleet.managerPhone} onChange={e => setNewFleet({ ...newFleet, managerPhone: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Parked Address</label>
                <input placeholder="Start typing address for Google suggestions..." value={newFleet.parkedAddress} onChange={e => setNewFleet({ ...newFleet, parkedAddress: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
            </div>
            <div style={{ marginTop: '40px', display: 'flex', gap: '16px' }}>
              <button onClick={addFleet} style={{ flex: 1, background: '#10b981', color: '#000', padding: '18px', borderRadius: '14px', fontWeight: 'bold' }}>Add Fleet</button>
              <button onClick={() => setShowAddFleet(false)} style={{ flex: 1, background: '#333', color: '#fff', padding: '18px', borderRadius: '14px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT VEHICLE MODAL */}
      {showAddVehicle && (
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', padding: '40px', borderRadius: '28px', width: '680px' }}>
            <h4 style={{ color: '#fff', marginBottom: '30px' }}>{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Registration</label>
                <input placeholder="ND 123 456" value={newVehicle.reg} onChange={e => setNewVehicle({ ...newVehicle, reg: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Type</label>
                <select value={newVehicle.type} onChange={e => setNewVehicle({ ...newVehicle, type: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                  {vehicleTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Driver Name</label>
                <select value={newVehicle.driver} onChange={e => setNewVehicle({ ...newVehicle, driver: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                  <option value="">Unassigned</option>
                  {driversList.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Fleet</label>
                <select value={newVehicle.fleetId} onChange={e => setNewVehicle({ ...newVehicle, fleetId: Number(e.target.value) })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                  {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  <option value={0}>Unassigned</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Parked Address</label>
                <input placeholder="Start typing address for Google suggestions..." value={newVehicle.parkedAddress} onChange={e => setNewVehicle({ ...newVehicle, parkedAddress: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>

              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Current Mileage (km)</label>
                <input type="number" value={newVehicle.mileage} onChange={e => setNewVehicle({ ...newVehicle, mileage: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Last Service Date</label>
                <input type="date" value={newVehicle.lastServiceDate} onChange={e => setNewVehicle({ ...newVehicle, lastServiceDate: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Service Interval (km)</label>
                <input type="number" value={newVehicle.serviceIntervalKm} onChange={e => setNewVehicle({ ...newVehicle, serviceIntervalKm: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Average Daily Usage (km/day)</label>
                <input type="number" value={newVehicle.avgDailyKm} onChange={e => setNewVehicle({ ...newVehicle, avgDailyKm: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Next Service Date (auto-calculated)</label>
                <div style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#10b981', fontWeight: 'bold', fontSize: '18px' }}>
                  {newVehicle.lastServiceDate && newVehicle.avgDailyKm && newVehicle.serviceIntervalKm
                    ? new Date(new Date(newVehicle.lastServiceDate).getTime() + (Number(newVehicle.serviceIntervalKm) / Number(newVehicle.avgDailyKm)) * 86400000).toLocaleDateString('en-GB')
                    : 'Enter last service date & daily usage'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '40px', display: 'flex', gap: '16px' }}>
              <button onClick={addOrUpdateVehicle} style={{ flex: 1, background: '#10b981', color: '#000', padding: '18px', borderRadius: '14px', fontWeight: 'bold' }}>
                {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
              </button>
              <button onClick={() => { setShowAddVehicle(false); setEditingVehicle(null) }} style={{ flex: 1, background: '#333', color: '#fff', padding: '18px', borderRadius: '14px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT VEHICLE TYPE MODAL */}
      {showAddType && (
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', padding: '40px', borderRadius: '28px', width: '520px' }}>
            <h4 style={{ color: '#fff', marginBottom: '24px' }}>{editingType ? 'Edit Vehicle Type' : 'Add New Vehicle Type'}</h4>
            <div>
              <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Vehicle Type Name</label>
              <input placeholder="e.g. Electric Van" value={newType.name} onChange={e => setNewType({ name: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
            </div>
            <div style={{ marginTop: '40px', display: 'flex', gap: '16px' }}>
              <button onClick={addOrUpdateType} style={{ flex: 1, background: '#10b981', color: '#000', padding: '18px', borderRadius: '14px', fontWeight: 'bold' }}>
                {editingType ? 'Save Changes' : 'Add Type'}
              </button>
              <button onClick={() => { setShowAddType(false); setEditingType(null) }} style={{ flex: 1, background: '#333', color: '#fff', padding: '18px', borderRadius: '14px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}